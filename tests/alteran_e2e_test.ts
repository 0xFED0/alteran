import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getVersionedJsrDistDir } from "../tools/prepare_jsr/mod.ts";
import {
  getReleaseZipPath,
  getVersionedZipDistDir,
} from "../tools/prepare_zip/mod.ts";
import { runCli } from "../src/alteran/mod.ts";
import { copyDirectory, ensureDir, removeIfExists } from "../src/alteran/fs.ts";
import {
  addApp,
  addTool,
  cleanDenoRuntime,
  generateShellEnv,
  getConfiguredAlteranArchiveSources,
  getConfiguredAlteranRunSources,
  initProject,
  listRegistry,
  refreshProject,
} from "../src/alteran/runtime.ts";
import { detectPlatform } from "../src/alteran/platform.ts";
import { ALTERAN_VERSION } from "../src/alteran/version.ts";
import {
  prepareBootstrapFixture,
  startStaticFileServer,
} from "./bootstrap_fixture.ts";

const ALTERAN_REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALTERAN_ENTRY_PATH = join(ALTERAN_REPO_DIR, "alteran.ts");

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

async function latestProjectLogDir(
  projectDir: string,
  category: "apps" | "tools" | "runs" | "tasks" | "tests",
): Promise<string> {
  const root = join(projectDir, ".runtime", "logs", category);
  const entries = await Array.fromAsync(Deno.readDir(root));
  const directories = entries.filter((entry) => entry.isDirectory)
    .map((entry) => entry.name)
    .sort();
  if (directories.length === 0) {
    throw new Error(`Expected at least one log dir under ${root}`);
  }
  return join(root, directories.at(-1)!);
}

function hostDenoPath(): string {
  return `${dirname(Deno.execPath())}:${Deno.env.get("PATH") ?? ""}`;
}

async function createLocalDenoReleaseDir(): Promise<string> {
  const tempDir = await Deno.makeTempDir({ prefix: "alteran-deno-source-" });
  const platform = detectPlatform();
  const releaseRoot = join(tempDir, "release");
  const version = Deno.version.deno;
  const normalizedVersion = version.startsWith("v") ? version : `v${version}`;
  const versionDir = join(releaseRoot, normalizedVersion);
  const archiveName = `deno-${platform.archiveTarget}.zip`;
  const stagingDir = join(tempDir, "staging");

  await Deno.mkdir(versionDir, { recursive: true });
  await Deno.mkdir(stagingDir, { recursive: true });
  await Deno.copyFile(Deno.execPath(), join(stagingDir, platform.denoBinaryName));
  if (!IS_WINDOWS) {
    await Deno.chmod(join(stagingDir, platform.denoBinaryName), 0o755);
  }
  await Deno.writeTextFile(
    join(releaseRoot, "release-latest.txt"),
    `${normalizedVersion}\n`,
  );

  const zipOutput = await new Deno.Command("zip", {
    args: ["-jq", join(versionDir, archiveName), join(stagingDir, platform.denoBinaryName)],
    stdout: "null",
    stderr: "piped",
  }).output();
  if (!zipOutput.success) {
    throw new Error(
      `Failed to create local Deno archive source: ${decode(zipOutput.stderr)}`,
    );
  }

  return releaseRoot;
}

async function seedManagedDeno(projectDir: string): Promise<void> {
  const platform = detectPlatform();
  const denoDir = join(projectDir, ".runtime", "deno", platform.id);
  const denoPath = join(denoDir, "bin", platform.denoBinaryName);
  const hostCacheDir = join(
    ALTERAN_REPO_DIR,
    ".runtime",
    "deno",
    platform.id,
    "cache",
  );
  const targetCacheDir = join(denoDir, "cache");
  await Deno.mkdir(join(denoDir, "bin"), { recursive: true });
  await Deno.mkdir(targetCacheDir, { recursive: true });
  await Deno.copyFile(Deno.execPath(), denoPath);
  try {
    await copyDirectory(hostCacheDir, targetCacheDir);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
  if (!IS_WINDOWS) {
    await Deno.chmod(denoPath, 0o755);
  }
}

async function runZsh(
  script: string,
  options: {
    cwd?: string;
    env?: Record<string, string>;
  } = {},
) {
  return await new Deno.Command("zsh", {
    args: ["-lc", script],
    cwd: options.cwd,
    env: {
      ...Deno.env.toObject(),
      ...options.env,
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
}

async function tryStartFixtureServer(rootDir: string): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
} | null> {
  try {
    return await startStaticFileServer(rootDir);
  } catch (error) {
    if (error instanceof Deno.errors.PermissionDenied) {
      return null;
    }
    throw error;
  }
}

async function makeRepoCopy(prefix: string): Promise<string> {
  const copyDir = await Deno.makeTempDir({ prefix });
  await copyDirectory(ALTERAN_REPO_DIR, copyDir, {
    filter: (absolutePath) => {
      const relativePath = absolutePath.slice(ALTERAN_REPO_DIR.length + 1)
        .replaceAll("\\", "/");
      return !relativePath.startsWith(".git/") &&
        !relativePath.startsWith(".runtime/");
    },
  });
  await removeIfExists(join(copyDir, ".runtime"));
  return copyDir;
}

function hermeticAlteranEnv(
  env: Record<string, string>,
): Record<string, string> {
  return {
    ...env,
    ALTERAN_SRC: "",
    ALTERAN_HOME: "",
  };
}

async function assertSuccessfulShellActivation(
  activationCommand: string,
  targetDir: string,
  env: Record<string, string>,
): Promise<void> {
  const output = await runZsh(
    `${activationCommand} >/dev/null && test "$ALTERAN_HOME" = ${
      JSON.stringify(join(targetDir, ".runtime"))
    } && test -f "$ALTERAN_HOME/alteran/mod.ts" && command -v deno >/dev/null && deno --version >/dev/null && alteran help >/dev/null`,
    { env: hermeticAlteranEnv(env) },
  );

  if (!output.success) {
    throw new Error(
      `Expected activation to succeed for ${targetDir}. stdout=${
        decode(output.stdout)
      } stderr=${decode(output.stderr)}`,
    );
  }
}

async function isNodeAvailable(): Promise<boolean> {
  try {
    const output = await new Deno.Command("node", {
      args: ["--version"],
      stdout: "null",
      stderr: "null",
    }).output();
    return output.success;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

const IS_WINDOWS = Deno.build.os === "windows";
const NODE_AVAILABLE = !IS_WINDOWS && await isNodeAvailable();

Deno.test("setupProject creates core Alteran layout", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-init-" });
  await initProject(projectDir);

  for (
    const path of [
      "setup",
      "setup.bat",
      "alteran.json",
      "deno.json",
      "activate",
      "activate.bat",
      ".gitignore",
      ".runtime/alteran/mod.ts",
      "apps",
      "tools",
      "libs",
      "tests",
    ]
  ) {
    try {
      await Deno.stat(join(projectDir, path));
    } catch (error) {
      throw new Error(`Expected ${path} to exist: ${error}`);
    }
  }

  const gitignore = await Deno.readTextFile(join(projectDir, ".gitignore"));
  for (const expected of [".runtime/", "apps/*/.runtime/", "dist/"]) {
    if (!gitignore.includes(expected)) {
      throw new Error(`Expected .gitignore to include ${expected}`);
    }
  }

  const activateSource = await Deno.readTextFile(join(projectDir, "activate"));
  if (
    !activateSource.includes(".runtime/deno/") ||
    !activateSource.includes("shellenv")
  ) {
    throw new Error(
      "Expected generated activate to use local Deno and delegate to alteran shellenv",
    );
  }

  try {
    await Deno.stat(join(projectDir, ".runtime", "env"));
    throw new Error("Expected .runtime/env to be absent under the new setup/activate architecture");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
});

Deno.test("addApp and addTool update registries and env aliases", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-registry-" });
  await initProject(projectDir);
  await addApp(projectDir, "hello");
  await addTool(projectDir, "seed");
  await refreshProject(projectDir);

  const apps = await listRegistry(projectDir, "apps");
  const tools = await listRegistry(projectDir, "tools");
  const shellenv = await generateShellEnv(projectDir);

  if (!apps.some((line) => line.startsWith("hello\t"))) {
    throw new Error(`Expected hello app in registry, got: ${apps.join(", ")}`);
  }
  if (!tools.some((line) => line.startsWith("seed\t"))) {
    throw new Error(
      `Expected at least one tool in registry, got: ${tools.join(", ")}`,
    );
  }
  if (!shellenv.includes("alias app-hello='alteran app run hello'")) {
    throw new Error("Expected generated app alias in shellenv");
  }
  if (!shellenv.includes("alias tool-seed='alteran tool run seed'")) {
    throw new Error("Expected generated tool alias in shellenv");
  }
  if (!shellenv.includes("alias atest='alteran test'")) {
    throw new Error("Expected generated test alias in shellenv");
  }
});

Deno.test("managed app setup and launcher scripts are generated and refresh can restore them", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-app-scripts-" });
  await seedManagedDeno(projectDir);
  await initProject(projectDir);
  await addApp(projectDir, "hello");

  const managedGitignore = await Deno.readTextFile(join(projectDir, ".gitignore"));
  for (const expected of [
    "apps/*/app",
    "apps/*/app.bat",
  ]) {
    if (!managedGitignore.includes(expected)) {
      throw new Error(`Expected managed .gitignore to include ${expected}`);
    }
  }
  for (const unexpected of ["apps/*/setup", "apps/*/setup.bat"]) {
    if (managedGitignore.includes(unexpected)) {
      throw new Error(`Expected managed .gitignore not to ignore ${unexpected}`);
    }
  }

  for (const path of [
    join(projectDir, "apps", "hello", "setup"),
    join(projectDir, "apps", "hello", "setup.bat"),
    join(projectDir, "apps", "hello", "app"),
    join(projectDir, "apps", "hello", "app.bat"),
  ]) {
    await removeIfExists(path);
  }

  await refreshProject(projectDir);

  for (const path of [
    join(projectDir, "apps", "hello", "setup"),
    join(projectDir, "apps", "hello", "setup.bat"),
    join(projectDir, "apps", "hello", "app"),
    join(projectDir, "apps", "hello", "app.bat"),
  ]) {
    await Deno.stat(path);
  }
});

Deno.test({
  name: "managed app launcher runs from another working directory",
  ignore: IS_WINDOWS,
  async fn() {
    const projectDir = await Deno.makeTempDir({ prefix: "alteran-managed-app-" });
    await seedManagedDeno(projectDir);
    await initProject(projectDir);
    await addApp(projectDir, "hello");

    const output = await runZsh(
      `cd /tmp && ${JSON.stringify(join(projectDir, "apps", "hello", "app"))} one two`,
      {
        env: {
          PATH: hostDenoPath(),
        },
      },
    );

    if (!output.success) {
      throw new Error(
        `Expected managed app launcher to succeed. stdout=${decode(output.stdout)} stderr=${decode(output.stderr)}`,
      );
    }

    const stdout = decode(output.stdout);
    if (!stdout.includes("App hello started")) {
      throw new Error(`Expected managed app launcher stdout, got: ${stdout}`);
    }
    if (!stdout.includes("one") || !stdout.includes("two")) {
      throw new Error(`Expected managed app launcher args to propagate, got: ${stdout}`);
    }
  },
});

Deno.test({
  name: "managed app launcher can bootstrap the managed project when runtime is missing",
  ignore: IS_WINDOWS,
  async fn() {
    const projectDir = await Deno.makeTempDir({
      prefix: "alteran-managed-app-bootstrap-",
    });
    const localDenoReleaseDir = await createLocalDenoReleaseDir();
    const localDenoServer = await tryStartFixtureServer(localDenoReleaseDir);
    if (localDenoServer === null) {
      await removeIfExists(dirname(localDenoReleaseDir));
      return;
    }
    await seedManagedDeno(projectDir);
    await initProject(projectDir);
    await addApp(projectDir, "hello");
    await removeIfExists(join(projectDir, ".runtime"));

    try {
      const output = await runZsh(
        `cd /tmp && ${JSON.stringify(join(projectDir, "apps", "hello", "app"))} alpha beta`,
        {
          env: {
            PATH: hostDenoPath(),
            DENO_SOURCES: localDenoServer.baseUrl,
            ALTERAN_RUN_SOURCES: ALTERAN_ENTRY_PATH,
            ALTERAN_SRC: join(ALTERAN_REPO_DIR, "src"),
          },
        },
      );

      if (!output.success) {
        throw new Error(
          `Expected managed app launcher to bootstrap missing runtime. stdout=${decode(output.stdout)} stderr=${decode(output.stderr)}`,
        );
      }

      await Deno.stat(join(projectDir, ".runtime", "alteran", "mod.ts"));
      const stdout = decode(output.stdout);
      if (!stdout.includes("App hello started")) {
        throw new Error(`Expected managed app bootstrap launcher stdout, got: ${stdout}`);
      }
    } finally {
      await localDenoServer.close();
      await removeIfExists(dirname(localDenoReleaseDir));
    }
  },
});

Deno.test({
  name: "managed app launcher rejects a mismatched app.json id",
  ignore: IS_WINDOWS,
  async fn() {
    const projectDir = await Deno.makeTempDir({
      prefix: "alteran-managed-app-id-mismatch-",
    });
    await seedManagedDeno(projectDir);
    await initProject(projectDir);
    await addApp(projectDir, "hello");

    await Deno.writeTextFile(
      join(projectDir, "apps", "hello", "app.json"),
      JSON.stringify(
        {
          name: "hello",
          id: "not-hello",
          version: "0.1.0",
          title: "hello",
          standalone: false,
          view: { enabled: false },
          entry: {
            core: "./core/mod.ts",
            view: "./view",
            app: "app",
          },
        },
        null,
        2,
      ) + "\n",
    );

    const output = await runZsh(
      `cd /tmp && ${JSON.stringify(join(projectDir, "apps", "hello", "app"))}`,
      {
        env: {
          PATH: hostDenoPath(),
        },
      },
    );

    if (output.success) {
      throw new Error(
        "Expected managed app launcher to fail when app.json id does not match the generated launcher identity",
      );
    }

    const stderr = decode(output.stderr);
    if (!stderr.includes("app.json id 'hello'")) {
      throw new Error(
        `Expected clear app id mismatch error, got: ${stderr}`,
      );
    }
  },
});

Deno.test("reimported app outside ./apps can be run through alteran app run", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-reimport-app-" });
  const previousCwd = Deno.cwd();
  const previousAlteranHome = Deno.env.get("ALTERAN_HOME");

  try {
    await seedManagedDeno(projectDir);
    await initProject(projectDir);
    const importedAppDir = join(projectDir, "incoming-apps", "admin-console");
    await ensureDir(join(importedAppDir, "core"));
    await Deno.writeTextFile(
      join(importedAppDir, "app.json"),
      JSON.stringify({
        name: "admin-console",
        id: "admin-console",
        version: "0.1.0",
        title: "Admin Console",
        standalone: false,
        view: { enabled: false },
        entry: {
          core: "./core/mod.ts",
          view: "./view",
          app: "app",
        },
      }, null, 2) + "\n",
    );
    await Deno.writeTextFile(
      join(importedAppDir, "deno.json"),
      JSON.stringify({
        tasks: {
          core: "deno run -A ./core/mod.ts",
          app: "deno task core",
        },
      }, null, 2) + "\n",
    );
    await Deno.writeTextFile(
      join(importedAppDir, "core", "mod.ts"),
      "console.log('admin-console-ok');\n",
    );

    Deno.chdir(projectDir);
    Deno.env.delete("ALTERAN_HOME");
    const reimportExitCode = await runCli(["reimport", "apps", "./incoming-apps"]);
    const runExitCode = await runCli(["app", "run", "admin-console"]);

    if (reimportExitCode !== 0) {
      throw new Error(`Expected reimport apps to succeed, got exit code ${reimportExitCode}`);
    }
    if (runExitCode !== 0) {
      throw new Error(
        `Expected alteran app run admin-console to succeed for a reimported external app, got exit code ${runExitCode}`,
      );
    }
  } finally {
    if (previousAlteranHome === undefined) {
      Deno.env.delete("ALTERAN_HOME");
    } else {
      Deno.env.set("ALTERAN_HOME", previousAlteranHome);
    }
    Deno.chdir(previousCwd);
  }
});

Deno.test("external alteran.json tool run isolates the target project context", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-external-tool-" });
  const previousEnv = new Map<string, string | undefined>();
  for (
    const key of [
      "ALTERAN_HOME",
      "ALTERAN_RUN_ID",
      "ALTERAN_ROOT_RUN_ID",
      "ALTERAN_PARENT_RUN_ID",
      "ALTERAN_ROOT_LOG_DIR",
      "ALTERAN_LOG_MODE",
      "ALTERAN_LOG_CONTEXT_JSON",
      "ALTERAN_LOGTAPE_ENABLED",
    ]
  ) {
    previousEnv.set(key, Deno.env.get(key));
  }

  try {
    await seedManagedDeno(projectDir);
    await initProject(projectDir);
    await addTool(projectDir, "probe");
    Deno.env.set("ALTERAN_HOME", join(ALTERAN_REPO_DIR, ".runtime"));
    Deno.env.set("ALTERAN_RUN_ID", "foreign-run");
    Deno.env.set("ALTERAN_ROOT_RUN_ID", "foreign-root");
    Deno.env.set(
      "ALTERAN_ROOT_LOG_DIR",
      join(ALTERAN_REPO_DIR, ".runtime", "logs", "tests", "foreign-root"),
    );

    const exitCode = await runCli([
      "external",
      join(projectDir, "alteran.json"),
      "tool",
      "run",
      "probe",
      "alpha",
    ]);
    if (exitCode !== 0) {
      throw new Error(`Expected external tool run to succeed, got exit code ${exitCode}`);
    }

    const logDir = await latestProjectLogDir(projectDir, "tools");
    const metadata = JSON.parse(await Deno.readTextFile(join(logDir, "metadata.json"))) as {
      name: string;
      cwd: string;
    };
    if (metadata.name !== "probe") {
      throw new Error(`Expected external tool log metadata to be for probe, got ${metadata.name}`);
    }
    if (metadata.cwd !== projectDir) {
      throw new Error(`Expected external tool cwd to be ${projectDir}, got ${metadata.cwd}`);
    }
  } finally {
    for (const [key, value] of previousEnv) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
});

Deno.test("ALTERAN_EXTERNAL_CTX can target a foreign project without a positional anchor", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-external-env-" });
  const previousCwd = Deno.cwd();
  const previousExternalCtx = Deno.env.get("ALTERAN_EXTERNAL_CTX");

  try {
    await seedManagedDeno(projectDir);
    await initProject(projectDir);
    await addTool(projectDir, "seed");
    Deno.chdir(ALTERAN_REPO_DIR);
    Deno.env.set("ALTERAN_EXTERNAL_CTX", join(projectDir, "alteran.json"));

    const exitCode = await runCli(["external", "tool", "run", "seed"]);
    if (exitCode !== 0) {
      throw new Error(
        `Expected external tool run through ALTERAN_EXTERNAL_CTX to succeed, got ${exitCode}`,
      );
    }

    const logDir = await latestProjectLogDir(projectDir, "tools");
    const metadata = JSON.parse(await Deno.readTextFile(join(logDir, "metadata.json"))) as {
      name: string;
    };
    if (metadata.name !== "seed") {
      throw new Error(`Expected external env-context tool log metadata to be for seed, got ${metadata.name}`);
    }
  } finally {
    Deno.chdir(previousCwd);
    if (previousExternalCtx === undefined) {
      Deno.env.delete("ALTERAN_EXTERNAL_CTX");
    } else {
      Deno.env.set("ALTERAN_EXTERNAL_CTX", previousExternalCtx);
    }
  }
});

Deno.test("external rejects deno.json as a context anchor", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-external-deno-json-" });

  await seedManagedDeno(projectDir);
  await initProject(projectDir);

  const exitCode = await runCli([
    "external",
    join(projectDir, "deno.json"),
    "tool",
    "ls",
  ]);
  if (exitCode === 0) {
    throw new Error("Expected external deno.json anchor to be rejected");
  }
});

Deno.test("external app.json app runs the anchored managed app", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-external-app-" });
  const previousEnv = new Map<string, string | undefined>();
  for (const key of ["ALTERAN_HOME", "ALTERAN_ROOT_LOG_DIR", "ALTERAN_RUN_ID", "ALTERAN_ROOT_RUN_ID"]) {
    previousEnv.set(key, Deno.env.get(key));
  }

  try {
    await initProject(projectDir);
    await addApp(projectDir, "hello");
    await Deno.writeTextFile(
      join(projectDir, "apps", "hello", "core", "mod.ts"),
      `export async function main(args: string[]): Promise<void> {
  console.log("external-app-ok", { args });
}

if (import.meta.main) {
  await main(Deno.args);
}
`,
    );
    Deno.env.set("ALTERAN_HOME", join(ALTERAN_REPO_DIR, ".runtime"));
    Deno.env.set(
      "ALTERAN_ROOT_LOG_DIR",
      join(ALTERAN_REPO_DIR, ".runtime", "logs", "tests", "foreign-root"),
    );
    Deno.env.set("ALTERAN_RUN_ID", "foreign-run");
    Deno.env.set("ALTERAN_ROOT_RUN_ID", "foreign-root");

    const exitCode = await runCli([
      "external",
      join(projectDir, "apps", "hello", "app.json"),
      "app",
      "red",
      "blue",
    ]);
    if (exitCode !== 0) {
      throw new Error(`Expected external app.json app launch to succeed, got ${exitCode}`);
    }

    const logDir = await latestProjectLogDir(projectDir, "apps");
    const metadata = JSON.parse(await Deno.readTextFile(join(logDir, "metadata.json"))) as {
      name: string;
    };
    if (metadata.name !== "hello") {
      throw new Error(`Expected external app log metadata to be for hello, got ${metadata.name}`);
    }
    const stdout = await Deno.readTextFile(join(logDir, "stdout.log"));
    if (!stdout.includes("external-app-ok")) {
      throw new Error("Expected external app stdout to be captured under the target project logs");
    }
  } finally {
    for (const [key, value] of previousEnv) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
});

Deno.test({
  name: "standalone app launcher auto-runs local setup when runtime is missing",
  ignore: IS_WINDOWS,
  async fn() {
    const appDir = await Deno.makeTempDir({ prefix: "alteran-standalone-app-" });
    const localDenoReleaseDir = await createLocalDenoReleaseDir();
    const localDenoServer = await tryStartFixtureServer(localDenoReleaseDir);
    if (localDenoServer === null) {
      await removeIfExists(dirname(localDenoReleaseDir));
      return;
    }
    const exitCode = await runCli(["app", "setup", appDir]);
    if (exitCode !== 0) {
      throw new Error(`Expected standalone app scaffold to be created, got exit code ${exitCode}`);
    }

    const standaloneGitignore = await Deno.readTextFile(join(appDir, ".gitignore"));
    for (const expected of [".runtime/", "app", "app.bat"]) {
      if (!standaloneGitignore.includes(expected)) {
        throw new Error(`Expected standalone app .gitignore to include ${expected}`);
      }
    }
    for (const unexpected of ["setup", "setup.bat"]) {
      if (standaloneGitignore.includes(unexpected)) {
        throw new Error(`Expected standalone app .gitignore not to ignore ${unexpected}`);
      }
    }

    await removeIfExists(join(appDir, ".runtime"));

    try {
      const output = await runZsh(
        `cd /tmp && ${JSON.stringify(join(appDir, "app"))} red blue`,
        {
          env: {
            PATH: hostDenoPath(),
            DENO_SOURCES: localDenoServer.baseUrl,
          },
        },
      );

      if (!output.success) {
        throw new Error(
          `Expected standalone app launcher to auto-setup and succeed. stdout=${decode(output.stdout)} stderr=${decode(output.stderr)}`,
        );
      }

      const platform = detectPlatform();
      const localDenoPath = join(
        appDir,
        ".runtime",
        "deno",
        platform.id,
        "bin",
        platform.denoBinaryName,
      );
      await Deno.stat(localDenoPath);
      const stdout = decode(output.stdout);
      if (!stdout.includes("Standalone app")) {
        throw new Error(`Expected standalone app launcher stdout, got: ${stdout}`);
      }
      if (!stdout.includes("red") || !stdout.includes("blue")) {
        throw new Error(`Expected standalone app launcher args to propagate, got: ${stdout}`);
      }
    } finally {
      await localDenoServer.close();
      await removeIfExists(dirname(localDenoReleaseDir));
    }
  },
});

Deno.test({
  name: "sourced activate does not leak nounset into the caller shell",
  ignore: IS_WINDOWS,
  async fn() {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-activate-" });
  await initProject(projectDir);

  const command = new Deno.Command("zsh", {
    args: [
      "-lc",
      `cd ${
        JSON.stringify(projectDir)
      } && unsetopt nounset && . ./activate >/dev/null 2>/dev/null && setopt | grep -x nounset`,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout).trim();
  const stderr = new TextDecoder().decode(output.stderr).trim();

  if (output.code !== 1) {
    throw new Error(
      `Expected sourced activate to leave nounset disabled, got exit code ${output.code}. stdout=${stdout} stderr=${stderr}`,
    );
  }

  if (stdout !== "") {
    throw new Error(
      `Expected no nounset output after sourcing activate, got: ${stdout}`,
    );
  }
  },
});

Deno.test({
  name: "repeated sourced activate does not reinitialize an initialized project",
  ignore: IS_WINDOWS,
  async fn() {
  const projectDir = await Deno.makeTempDir({
    prefix: "alteran-activate-quiet-",
  });
  await initProject(projectDir);

  const command = new Deno.Command("zsh", {
    args: [
      "-lc",
      `cd ${
        JSON.stringify(projectDir)
      } && output=$({ . ./activate >/dev/null; . ./activate >/dev/null; } 2>&1); printf '%s' "$output"`,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr).trim();

  if (!output.success) {
    throw new Error(
      `Expected repeated sourced activate to succeed. stdout=${stdout} stderr=${stderr}`,
    );
  }
  if (stdout.includes("Initialized Alteran project at")) {
    throw new Error(
      `Expected repeated sourced activate not to reinitialize the project. stdout=${stdout}`,
    );
  }
  if (stdout.includes("Set up Alteran project at")) {
    throw new Error(
      `Expected repeated sourced activate not to run setup. stdout=${stdout}`,
    );
  }
  },
});

Deno.test("runCli provides help for subcommands instead of treating help as data", async () => {
  const consoleLog = console.log;
  const messages: string[] = [];
  console.log = (...args: unknown[]) => {
    messages.push(args.map(String).join(" "));
  };

  try {
    const appHelpExitCode = await runCli(["app", "--help"]);
    const cleanHelpExitCode = await runCli(["clean", "--help"]);
    const cleanNoScopeExitCode = await runCli(["clean"]);
    const externalHelpExitCode = await runCli(["external", "--help"]);

    if (
      appHelpExitCode !== 0 || cleanHelpExitCode !== 0 ||
      cleanNoScopeExitCode !== 0 || externalHelpExitCode !== 0
    ) {
      throw new Error("Expected help invocations to exit with code 0");
    }

    const joined = messages.join("\n");
    if (!joined.includes("alteran app")) {
      throw new Error("Expected app help output");
    }
    if (!joined.includes("alteran clean")) {
      throw new Error("Expected clean help output");
    }
    if (!joined.includes("alteran external")) {
      throw new Error("Expected external help output");
    }
    if (!joined.includes("Scopes:")) {
      throw new Error("Expected clean scopes in help output");
    }
    if (!joined.includes("alteran clean <scope> [<scope> ...]")) {
      throw new Error("Expected multi-scope clean usage in help output");
    }
  } finally {
    console.log = consoleLog;
  }
});

Deno.test("alteran test delegates to managed deno test", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-cli-test-" });
  await initProject(projectDir);
  await Deno.writeTextFile(
    join(projectDir, "tests", "sample_test.ts"),
    'Deno.test("sample", () => {});\n',
  );

  const previousAlteranHome = Deno.env.get("ALTERAN_HOME");
  Deno.env.set("ALTERAN_HOME", join(projectDir, ".runtime"));

  try {
    const exitCode = await runCli(["test", "tests/sample_test.ts"]);
    if (exitCode !== 0) {
      throw new Error(
        `Expected alteran test to pass, got exit code ${exitCode}`,
      );
    }
  } finally {
    if (previousAlteranHome === undefined) {
      Deno.env.delete("ALTERAN_HOME");
    } else {
      Deno.env.set("ALTERAN_HOME", previousAlteranHome);
    }
  }
});

Deno.test("alteran test stores logs under tests top-level log category", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-test-logs-" });
  await initProject(projectDir);
  await Deno.writeTextFile(
    join(projectDir, "tests", "sample_test.ts"),
    'Deno.test("sample", () => {});\n',
  );

  const previousAlteranHome = Deno.env.get("ALTERAN_HOME");
  Deno.env.set("ALTERAN_HOME", join(projectDir, ".runtime"));

  try {
    const exitCode = await runCli(["test", "tests/sample_test.ts"]);
    if (exitCode !== 0) {
      throw new Error(
        `Expected alteran test to pass, got exit code ${exitCode}`,
      );
    }

    const testsLogDir = join(projectDir, ".runtime", "logs", "tests");
    const runsLogDir = join(projectDir, ".runtime", "logs", "runs");
    const testEntries = await Array.fromAsync(Deno.readDir(testsLogDir));
    if (testEntries.length === 0) {
      throw new Error(
        "Expected alteran test logs to appear under .runtime/logs/tests/",
      );
    }

    try {
      const runEntries = await Array.fromAsync(Deno.readDir(runsLogDir));
      if (runEntries.some((entry) => entry.name.includes("sample-test-ts"))) {
        throw new Error(
          "Expected alteran test logs not to be categorized under runs/",
        );
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  } finally {
    if (previousAlteranHome === undefined) {
      Deno.env.delete("ALTERAN_HOME");
    } else {
      Deno.env.set("ALTERAN_HOME", previousAlteranHome);
    }
  }
});

Deno.test("alteran task runs deno-based tasks with managed preinit context", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-task-preinit-" });
  const previousCwd = Deno.cwd();
  const previousAlteranHome = Deno.env.get("ALTERAN_HOME");

  try {
    await initProject(projectDir);
    await Deno.writeTextFile(
      join(projectDir, "deno.json"),
      JSON.stringify({
        tasks: {
          probe:
            'deno eval "console.log(globalThis.__alteran_preinit__ ? \\"managed\\" : \\"plain\\")"',
        },
      }, null, 2) + "\n",
    );

    Deno.chdir(projectDir);
    Deno.env.set("ALTERAN_HOME", join(projectDir, ".runtime"));
    const exitCode = await runCli(["task", "probe"]);
    if (exitCode !== 0) {
      throw new Error(`Expected alteran task probe to succeed, got exit code ${exitCode}`);
    }
  } finally {
    if (previousAlteranHome === undefined) {
      Deno.env.delete("ALTERAN_HOME");
    } else {
      Deno.env.set("ALTERAN_HOME", previousAlteranHome);
    }
    Deno.chdir(previousCwd);
  }
});

Deno.test("alteran clean accepts multiple scopes", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-clean-" });
  await initProject(projectDir);

  const logsDir = join(projectDir, ".runtime", "logs");
  await Deno.writeTextFile(join(logsDir, "custom.log"), "logs");

  const previousAlteranHome = Deno.env.get("ALTERAN_HOME");
  Deno.env.set("ALTERAN_HOME", join(projectDir, ".runtime"));

  try {
    const exitCode = await runCli(["clean", "env", "logs"]);
    if (exitCode !== 0) {
      throw new Error(
        `Expected alteran clean env logs to pass, got exit code ${exitCode}`,
      );
    }

    const logEntries = await Array.fromAsync(Deno.readDir(logsDir));
    for (const removedPath of [
      join(projectDir, "activate"),
      join(projectDir, "activate.bat"),
    ]) {
      try {
        await Deno.stat(removedPath);
        throw new Error(`Expected ${removedPath} to be removed by clean env`);
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
          throw error;
        }
      }
    }
    if (logEntries.some((entry) => entry.name === "custom.log")) {
      throw new Error("Expected logs scope to remove custom log artifacts");
    }
  } finally {
    if (previousAlteranHome === undefined) {
      Deno.env.delete("ALTERAN_HOME");
    } else {
      Deno.env.set("ALTERAN_HOME", previousAlteranHome);
    }
  }
});

Deno.test("alteran clean all matches the safe-cleanup specification", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-clean-all-" });
  await initProject(projectDir);

  await Deno.mkdir(join(projectDir, "apps", "demo", ".runtime"), {
    recursive: true,
  });
  await Deno.writeTextFile(
    join(projectDir, "apps", "demo", ".runtime", "marker.txt"),
    "demo",
  );
  await Deno.mkdir(join(projectDir, "dist", "jsr"), { recursive: true });
  await Deno.writeTextFile(
    join(projectDir, "dist", "jsr", "artifact.txt"),
    "dist",
  );

  const previousAlteranHome = Deno.env.get("ALTERAN_HOME");
  Deno.env.set("ALTERAN_HOME", join(projectDir, ".runtime"));

  try {
    const exitCode = await runCli(["clean", "all"]);
    if (exitCode !== 0) {
      throw new Error(
        `Expected alteran clean all to pass, got exit code ${exitCode}`,
      );
    }

    try {
      await Deno.stat(join(projectDir, "apps", "demo", ".runtime"));
      throw new Error("Expected clean all to remove nested app runtimes");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    try {
      await Deno.stat(join(projectDir, "dist", "jsr", "artifact.txt"));
      throw new Error("Expected clean all to remove dist artifacts");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    for (
      const preservedPath of [
        join(projectDir, "setup"),
        join(projectDir, "setup.bat"),
        join(projectDir, "alteran.json"),
        join(projectDir, "deno.json"),
        join(projectDir, "apps"),
        join(projectDir, "tools"),
        join(projectDir, "libs"),
        join(projectDir, "tests"),
        join(projectDir, ".runtime", "logs"),
        join(projectDir, ".runtime", "deno"),
        join(projectDir, "dist", "jsr"),
      ]
    ) {
      await Deno.stat(preservedPath);
    }

    for (const removedPath of [
      join(projectDir, "activate"),
      join(projectDir, "activate.bat"),
    ]) {
      try {
        await Deno.stat(removedPath);
        throw new Error(`Expected ${removedPath} to be removed by clean all`);
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
          throw error;
        }
      }
    }
  } finally {
    if (previousAlteranHome === undefined) {
      Deno.env.delete("ALTERAN_HOME");
    } else {
      Deno.env.set("ALTERAN_HOME", previousAlteranHome);
    }
  }
});

Deno.test("release helpers use versioned dist directories", () => {
  const repoRoot = "/tmp/alteran";

  if (
    getVersionedJsrDistDir(repoRoot) !==
      `/tmp/alteran/dist/jsr/${ALTERAN_VERSION}`
  ) {
    throw new Error("Expected prepare_jsr output to be versioned");
  }

  if (
    getVersionedZipDistDir(repoRoot) !==
      `/tmp/alteran/dist/zips/${ALTERAN_VERSION}`
  ) {
    throw new Error("Expected prepare_zip output directory to be versioned");
  }

  if (
    getReleaseZipPath(repoRoot) !==
      `/tmp/alteran/dist/zips/${ALTERAN_VERSION}/alteran-v${ALTERAN_VERSION}.zip`
  ) {
    throw new Error("Expected release zip path to include version");
  }
});

Deno.test("Alteran source lists prefer run sources and support legacy alias", () => {
  const previousRun = Deno.env.get("ALTERAN_RUN_SOURCES");
  const previousArchive = Deno.env.get("ALTERAN_ARCHIVE_SOURCES");
  const previousLegacy = Deno.env.get("ALTERAN_SOURCES");

  Deno.env.delete("ALTERAN_RUN_SOURCES");
  Deno.env.delete("ALTERAN_ARCHIVE_SOURCES");
  Deno.env.set(
    "ALTERAN_SOURCES",
    "jsr:@alteran https://example.com/alteran.ts",
  );

  try {
    const runSources = getConfiguredAlteranRunSources();
    const archiveSources = getConfiguredAlteranArchiveSources();

    if (
      runSources.join("|") !== "jsr:@alteran|https://example.com/alteran.ts"
    ) {
      throw new Error(
        `Expected legacy ALTERAN_SOURCES alias to populate run sources, got ${
          runSources.join(", ")
        }`,
      );
    }

    if (archiveSources.length !== 0) {
      throw new Error("Expected archive sources to default to an empty list");
    }
  } finally {
    if (previousRun === undefined) {
      Deno.env.delete("ALTERAN_RUN_SOURCES");
    } else {
      Deno.env.set("ALTERAN_RUN_SOURCES", previousRun);
    }
    if (previousArchive === undefined) {
      Deno.env.delete("ALTERAN_ARCHIVE_SOURCES");
    } else {
      Deno.env.set("ALTERAN_ARCHIVE_SOURCES", previousArchive);
    }
    if (previousLegacy === undefined) {
      Deno.env.delete("ALTERAN_SOURCES");
    } else {
      Deno.env.set("ALTERAN_SOURCES", previousLegacy);
    }
  }
});

Deno.test("alteran clean runtime removes unexpected legacy entries under .runtime", async () => {
  const projectDir = await Deno.makeTempDir({
    prefix: "alteran-runtime-clean-",
  });
  await initProject(projectDir);

  const legacyPlatformDir = join(projectDir, ".runtime", "macos-arm64");
  const strayFile = join(projectDir, ".runtime", "unexpected.txt");
  const runtimeTool = join(projectDir, ".runtime", "tools", "alterun.ts");
  const runtimeLib = join(projectDir, ".runtime", "libs", "shared.ts");
  await Deno.mkdir(legacyPlatformDir, { recursive: true });
  await Deno.writeTextFile(join(legacyPlatformDir, "marker.txt"), "legacy");
  await Deno.writeTextFile(strayFile, "stray");
  await Deno.writeTextFile(runtimeTool, "export const tool = true;\n");
  await Deno.writeTextFile(runtimeLib, "export const lib = true;\n");

  const previousAlteranHome = Deno.env.get("ALTERAN_HOME");
  Deno.env.set("ALTERAN_HOME", join(projectDir, ".runtime"));

  try {
    const exitCode = await runCli(["clean", "runtime"]);
    if (exitCode !== 0) {
      throw new Error(
        `Expected alteran clean runtime to pass, got exit code ${exitCode}`,
      );
    }

    try {
      await Deno.stat(legacyPlatformDir);
      throw new Error("Expected legacy .runtime/macos-arm64 to be removed");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    try {
      await Deno.stat(strayFile);
      throw new Error("Expected stray .runtime file to be removed");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    await Deno.stat(join(projectDir, ".runtime", "deno"));
    await Deno.stat(runtimeTool);
    await Deno.stat(runtimeLib);
    try {
      await Deno.stat(join(projectDir, ".runtime", "env"));
      throw new Error("Expected .runtime/env to stay absent after clean runtime");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  } finally {
    if (previousAlteranHome === undefined) {
      Deno.env.delete("ALTERAN_HOME");
    } else {
      Deno.env.set("ALTERAN_HOME", previousAlteranHome);
    }
  }
});

Deno.test("cleanDenoRuntime preserves the active managed deno binary", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-deno-clean-" });
  await initProject(projectDir);

  const platform = detectPlatform();
  const platformDir = join(projectDir, ".runtime", "deno", platform.id);
  const binDir = join(platformDir, "bin");
  const activeDenoPath = join(binDir, platform.denoBinaryName);
  const extraBinPath = join(binDir, "extra-tool");
  const cacheMarker = join(platformDir, "cache", "old.cache");
  const stalePlatformDir = join(
    projectDir,
    ".runtime",
    "deno",
    "stale-platform",
  );

  await Deno.mkdir(binDir, { recursive: true });
  await Deno.writeTextFile(activeDenoPath, "managed deno");
  await Deno.writeTextFile(extraBinPath, "extra");
  await Deno.mkdir(join(platformDir, "cache"), { recursive: true });
  await Deno.writeTextFile(cacheMarker, "cache");
  await Deno.mkdir(stalePlatformDir, { recursive: true });
  await Deno.writeTextFile(join(stalePlatformDir, "stale.txt"), "stale");

  await cleanDenoRuntime(projectDir, activeDenoPath);

  await Deno.stat(activeDenoPath);
  try {
    await Deno.stat(extraBinPath);
    throw new Error("Expected non-active bin entries to be removed");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  try {
    await Deno.stat(join(stalePlatformDir, "stale.txt"));
    throw new Error("Expected stale platform directories to be removed");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  await Deno.stat(join(platformDir, "cache"));
});

Deno.test("alteran compact removes generated runtime artifacts but keeps bootstrap files", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-compact-" });
  await initProject(projectDir);

  await Deno.mkdir(join(projectDir, "apps", "demo", ".runtime"), {
    recursive: true,
  });
  await Deno.writeTextFile(
    join(projectDir, "apps", "demo", ".runtime", "marker.txt"),
    "demo",
  );
  await Deno.mkdir(join(projectDir, "dist", "jsr"), { recursive: true });
  await Deno.writeTextFile(
    join(projectDir, "dist", "jsr", "artifact.txt"),
    "dist",
  );

  const previousAlteranHome = Deno.env.get("ALTERAN_HOME");
  Deno.env.set("ALTERAN_HOME", join(projectDir, ".runtime"));

  try {
    const exitCode = await runCli(["compact", "-y"]);
    if (exitCode !== 0) {
      throw new Error(
        `Expected alteran compact -y to pass, got exit code ${exitCode}`,
      );
    }

    for (
      const removedPath of [
        join(projectDir, ".runtime"),
        join(projectDir, "dist"),
        join(projectDir, "apps", "demo", ".runtime"),
      ]
    ) {
      try {
        await Deno.stat(removedPath);
        throw new Error(`Expected ${removedPath} to be removed by compact`);
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
          throw error;
        }
      }
    }

    for (
      const preservedPath of [
        join(projectDir, "setup"),
        join(projectDir, "setup.bat"),
        join(projectDir, "alteran.json"),
        join(projectDir, "deno.json"),
        join(projectDir, ".gitignore"),
        join(projectDir, "apps"),
        join(projectDir, "tools"),
        join(projectDir, "libs"),
        join(projectDir, "tests"),
      ]
    ) {
      await Deno.stat(preservedPath);
    }

    if (Deno.build.os !== "windows") {
      const command = new Deno.Command("zsh", {
        args: [
          "-lc",
          `cd ${
            JSON.stringify(projectDir)
          } && ./setup >/dev/null 2>/dev/null && . ./activate >/dev/null 2>/dev/null && test -f .runtime/alteran/mod.ts && test ! -d .runtime/env`,
        ],
        env: {
          ...Deno.env.toObject(),
          ALTERAN_RUN_SOURCES: ALTERAN_ENTRY_PATH,
          PATH: `${join(dirname(Deno.execPath()))}:${
            Deno.env.get("PATH") ?? ""
          }`,
        },
        stdout: "piped",
        stderr: "piped",
      });
      const output = await command.output();
      if (!output.success) {
        throw new Error(
          `Expected activate to rehydrate compacted project. stdout=${
            new TextDecoder().decode(output.stdout)
          } stderr=${new TextDecoder().decode(output.stderr)}`,
        );
      }
    }
  } finally {
    if (previousAlteranHome === undefined) {
      Deno.env.delete("ALTERAN_HOME");
    } else {
      Deno.env.set("ALTERAN_HOME", previousAlteranHome);
    }
  }
});

Deno.test("alteran compact -n cancels without changing the project", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-compact-no-" });
  await initProject(projectDir);

  const previousAlteranHome = Deno.env.get("ALTERAN_HOME");
  Deno.env.set("ALTERAN_HOME", join(projectDir, ".runtime"));

  try {
    const exitCode = await runCli(["compact", "-n"]);
    if (exitCode !== 0) {
      throw new Error(
        `Expected alteran compact -n to exit cleanly, got ${exitCode}`,
      );
    }

    await Deno.stat(join(projectDir, ".runtime"));
    await Deno.stat(join(projectDir, "activate"));
  } finally {
    if (previousAlteranHome === undefined) {
      Deno.env.delete("ALTERAN_HOME");
    } else {
      Deno.env.set("ALTERAN_HOME", previousAlteranHome);
    }
  }
});

Deno.test("alteran compact prompts and cancels by default when the answer is no", async () => {
  const projectDir = await Deno.makeTempDir({
    prefix: "alteran-compact-prompt-no-",
  });
  await initProject(projectDir);

  const previousAlteranHome = Deno.env.get("ALTERAN_HOME");
  const previousPrompt = globalThis.prompt;
  const stdinDescriptor = Object.getOwnPropertyDescriptor(
    Deno.stdin,
    "isTerminal",
  );

  Deno.env.set("ALTERAN_HOME", join(projectDir, ".runtime"));
  Object.defineProperty(Deno.stdin, "isTerminal", {
    configurable: true,
    value: () => true,
  });
  globalThis.prompt = () => "n";

  try {
    const exitCode = await runCli(["compact"]);
    if (exitCode !== 0) {
      throw new Error(
        `Expected alteran compact prompt cancel to exit cleanly, got ${exitCode}`,
      );
    }

    await Deno.stat(join(projectDir, ".runtime"));
  } finally {
    globalThis.prompt = previousPrompt;
    if (stdinDescriptor) {
      Object.defineProperty(Deno.stdin, "isTerminal", stdinDescriptor);
    }
    if (previousAlteranHome === undefined) {
      Deno.env.delete("ALTERAN_HOME");
    } else {
      Deno.env.set("ALTERAN_HOME", previousAlteranHome);
    }
  }
});

Deno.test("alteran compact requires explicit confirmation in non-interactive mode", async () => {
  const projectDir = await Deno.makeTempDir({
    prefix: "alteran-compact-noninteractive-",
  });
  await initProject(projectDir);

  const previousAlteranHome = Deno.env.get("ALTERAN_HOME");
  const stdinDescriptor = Object.getOwnPropertyDescriptor(
    Deno.stdin,
    "isTerminal",
  );

  Deno.env.set("ALTERAN_HOME", join(projectDir, ".runtime"));
  Object.defineProperty(Deno.stdin, "isTerminal", {
    configurable: true,
    value: () => false,
  });

  try {
    const exitCode = await runCli(["compact"]);
    if (exitCode !== 1) {
      throw new Error(
        `Expected alteran compact without flags in non-interactive mode to fail, got ${exitCode}`,
      );
    }

    await Deno.stat(join(projectDir, ".runtime"));
  } finally {
    if (stdinDescriptor) {
      Object.defineProperty(Deno.stdin, "isTerminal", stdinDescriptor);
    }
    if (previousAlteranHome === undefined) {
      Deno.env.delete("ALTERAN_HOME");
    } else {
      Deno.env.set("ALTERAN_HOME", previousAlteranHome);
    }
  }
});

Deno.test({
  name: "node compatibility bridge can show CLI help",
  ignore: !NODE_AVAILABLE,
  async fn() {
  const command = new Deno.Command("node", {
    args: [ALTERAN_ENTRY_PATH, "--help"],
    cwd: ALTERAN_REPO_DIR,
    env: {
      ...Deno.env.toObject(),
      PATH: `${dirname(Deno.execPath())}:${Deno.env.get("PATH") ?? ""}`,
    },
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  if (!output.success) {
    throw new Error(
      `Expected node bridge help to succeed. stdout=${stdout} stderr=${stderr}`,
    );
  }
  if (!stdout.includes("Alteran") || !stdout.includes("alteran setup [dir]")) {
    throw new Error(
      `Expected Alteran help output from node bridge, got: ${stdout}`,
    );
  }
  },
});

Deno.test({
  name: "node compatibility bridge can set up a project through Deno",
  ignore: !NODE_AVAILABLE,
  async fn() {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-node-init-" });
  const command = new Deno.Command("node", {
    args: [ALTERAN_ENTRY_PATH, "setup", projectDir],
    cwd: ALTERAN_REPO_DIR,
    env: {
      ...Deno.env.toObject(),
      PATH: `${dirname(Deno.execPath())}:${Deno.env.get("PATH") ?? ""}`,
    },
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  if (!output.success) {
    throw new Error(
      `Expected node bridge setup to succeed. stdout=${stdout} stderr=${stderr}`,
    );
  }

  for (
    const expectedPath of [
      join(projectDir, "setup"),
      join(projectDir, "setup.bat"),
      join(projectDir, "activate"),
      join(projectDir, "activate.bat"),
      join(projectDir, "alteran.json"),
      join(projectDir, "deno.json"),
      join(projectDir, ".runtime", "alteran", "mod.ts"),
    ]
  ) {
    await Deno.stat(expectedPath);
  }
  },
});

Deno.test({
  name: "copied setup bootstraps an empty project directory and generates local activation",
  ignore: IS_WINDOWS,
  async fn() {
  const projectDir = await Deno.makeTempDir({
    prefix: "alteran-copy-setup-",
  });
  await Deno.copyFile(
    join(ALTERAN_REPO_DIR, "setup"),
    join(projectDir, "setup"),
  );
  await Deno.copyFile(
    join(ALTERAN_REPO_DIR, "setup.bat"),
    join(projectDir, "setup.bat"),
  );
  await Deno.chmod(join(projectDir, "setup"), 0o755);

  await assertSuccessfulShellActivation(
    `cd ${JSON.stringify(projectDir)} && ./setup >/dev/null && . ./activate`,
    projectDir,
    {
      ALTERAN_RUN_SOURCES: ALTERAN_ENTRY_PATH,
      PATH: hostDenoPath(),
    },
  );

  for (
    const expectedPath of [
      "setup",
      "setup.bat",
      "alteran.json",
      "deno.json",
      "activate",
      "activate.bat",
      ".runtime/alteran/mod.ts",
    ]
  ) {
    await Deno.stat(join(projectDir, expectedPath));
  }

  try {
    await Deno.stat(join(projectDir, ".runtime", "env"));
    throw new Error("Expected copied setup bootstrap not to generate .runtime/env");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
  },
});

Deno.test({
  name: "copied setup can bootstrap from hosted runnable source when archive source is also available",
  ignore: IS_WINDOWS,
  async fn() {
    const fixture = await prepareBootstrapFixture(ALTERAN_REPO_DIR);
    const server = await tryStartFixtureServer(fixture.servedDir);
    if (server === null) {
      await fixture.cleanup();
      return;
    }
    const projectDir = await Deno.makeTempDir({
      prefix: "alteran-copy-activate-http-run-",
    });

    try {
      await Deno.copyFile(
        join(ALTERAN_REPO_DIR, "setup"),
        join(projectDir, "setup"),
      );
      await Deno.copyFile(
        join(ALTERAN_REPO_DIR, "setup.bat"),
        join(projectDir, "setup.bat"),
      );
      await Deno.chmod(join(projectDir, "setup"), 0o755);

      await assertSuccessfulShellActivation(
        `cd ${JSON.stringify(projectDir)} && ./setup >/dev/null && . ./activate`,
        projectDir,
        {
          ALTERAN_RUN_SOURCES: `${server.baseUrl}${fixture.runSourceUrlPath}`,
          ALTERAN_ARCHIVE_SOURCES: `${server.baseUrl}/alteran.zip`,
          PATH: hostDenoPath(),
        },
      );
    } finally {
      await server.close();
      await fixture.cleanup();
    }
  },
});

Deno.test({
  name: "hosted runnable source alone fails because archive sources are required for materialization",
  ignore: IS_WINDOWS,
  async fn() {
    const fixture = await prepareBootstrapFixture(ALTERAN_REPO_DIR);
    const server = await tryStartFixtureServer(fixture.servedDir);
    if (server === null) {
      await fixture.cleanup();
      return;
    }
    const projectDir = await Deno.makeTempDir({
      prefix: "alteran-copy-activate-http-run-only-",
    });

    try {
      await Deno.copyFile(
        join(ALTERAN_REPO_DIR, "setup"),
        join(projectDir, "setup"),
      );
      await Deno.copyFile(
        join(ALTERAN_REPO_DIR, "setup.bat"),
        join(projectDir, "setup.bat"),
      );
      await Deno.chmod(join(projectDir, "setup"), 0o755);

      const output = await runZsh(
        `cd ${JSON.stringify(projectDir)} && ./setup`,
        {
          env: hermeticAlteranEnv({
            ...Deno.env.toObject(),
            ALTERAN_RUN_SOURCES: `${server.baseUrl}${fixture.runSourceUrlPath}`,
            ALTERAN_ARCHIVE_SOURCES: "",
            PATH: hostDenoPath(),
          }),
        },
      );

      if (output.success) {
        throw new Error(
          "Expected hosted runnable source without archive source to fail materialization, but activation succeeded.",
        );
      }

      const stderr = decode(output.stderr);
      if (!stderr.includes("ALTERAN_ARCHIVE_SOURCES is empty")) {
        throw new Error(
          `Expected missing archive-source guidance, got stderr=${stderr}`,
        );
      }
    } finally {
      await server.close();
      await fixture.cleanup();
    }
  },
});

Deno.test({
  name: "copied setup can bootstrap from hosted archive source",
  ignore: IS_WINDOWS,
  async fn() {
    const fixture = await prepareBootstrapFixture(ALTERAN_REPO_DIR);
    const server = await tryStartFixtureServer(fixture.servedDir);
    if (server === null) {
      await fixture.cleanup();
      return;
    }
    const projectDir = await Deno.makeTempDir({
      prefix: "alteran-copy-activate-http-archive-",
    });

    try {
      await Deno.copyFile(
        join(ALTERAN_REPO_DIR, "setup"),
        join(projectDir, "setup"),
      );
      await Deno.copyFile(
        join(ALTERAN_REPO_DIR, "setup.bat"),
        join(projectDir, "setup.bat"),
      );
      await Deno.chmod(join(projectDir, "setup"), 0o755);

      await assertSuccessfulShellActivation(
        `cd ${JSON.stringify(projectDir)} && ./setup >/dev/null && . ./activate`,
        projectDir,
        {
          ALTERAN_RUN_SOURCES: "",
          ALTERAN_ARCHIVE_SOURCES: `${server.baseUrl}/alteran.zip`,
          PATH: hostDenoPath(),
        },
      );
    } finally {
      await server.close();
      await fixture.cleanup();
    }
  },
});

Deno.test({
  name: "repository setup can initialize an explicit target directory and generated activate can then be sourced",
  ignore: IS_WINDOWS,
  async fn() {
  const projectDir = await Deno.makeTempDir({
    prefix: "alteran-explicit-target-",
  });

  await assertSuccessfulShellActivation(
    `sh ${JSON.stringify(join(ALTERAN_REPO_DIR, "setup"))} ${
      JSON.stringify(projectDir)
    } >/dev/null && . ${JSON.stringify(join(projectDir, "activate"))}`,
    projectDir,
    {
      PATH: hostDenoPath(),
    },
  );
  },
});

Deno.test({
  name: "activated repository environment can set up an external target project",
  ignore: IS_WINDOWS,
  async fn() {
  const repoCopy = await makeRepoCopy("alteran-repo-env-");
  const projectDir = await Deno.makeTempDir({
    prefix: "alteran-repo-env-target-",
  });

  try {
    const initOutput = await runZsh(
      `cd ${
        JSON.stringify(repoCopy)
      } && ./setup >/dev/null && . ./activate >/dev/null && alteran setup ${
        JSON.stringify(projectDir)
      } >/dev/null`,
      {
        env: {
          PATH: hostDenoPath(),
        },
      },
    );

    if (!initOutput.success) {
      throw new Error(
        `Expected repo environment setup to succeed. stdout=${
          decode(initOutput.stdout)
        } stderr=${decode(initOutput.stderr)}`,
      );
    }

    await assertSuccessfulShellActivation(
      `. ${JSON.stringify(join(projectDir, "activate"))}`,
      projectDir,
      {
        PATH: hostDenoPath(),
      },
    );
  } finally {
    await removeIfExists(repoCopy);
  }
  },
});

Deno.test("direct deno run alteran.ts setup bootstraps a target without prior activation", async () => {
  const projectDir = await Deno.makeTempDir({
    prefix: "alteran-direct-init-",
  });

  const output = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", ALTERAN_ENTRY_PATH, "setup", projectDir],
    cwd: ALTERAN_REPO_DIR,
    env: Deno.env.toObject(),
    stdout: "piped",
    stderr: "piped",
  }).output();

  if (!output.success) {
    throw new Error(
      `Expected direct setup to succeed. stdout=${
        decode(output.stdout)
      } stderr=${decode(output.stderr)}`,
    );
  }

  if (
    !decode(output.stderr).includes(
      `Set up Alteran project at ${projectDir}`,
    )
  ) {
    throw new Error("Expected setup to report the target path");
  }

  if (Deno.build.os !== "windows") {
    await assertSuccessfulShellActivation(
      `. ${JSON.stringify(join(projectDir, "activate"))}`,
      projectDir,
      {
        PATH: hostDenoPath(),
      },
    );
  }
});

Deno.test({
  name: "alteran shellenv can activate a project after direct setup",
  ignore: IS_WINDOWS,
  async fn() {
  const projectDir = await Deno.makeTempDir({
    prefix: "alteran-direct-shellenv-",
  });

  const setupOutput = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", ALTERAN_ENTRY_PATH, "setup", projectDir],
    cwd: ALTERAN_REPO_DIR,
    env: Deno.env.toObject(),
    stdout: "piped",
    stderr: "piped",
  }).output();

  if (!setupOutput.success) {
    throw new Error(
      `Expected setup to succeed. stdout=${
        decode(setupOutput.stdout)
      } stderr=${decode(setupOutput.stderr)}`,
    );
  }

  if (
    !decode(setupOutput.stderr).includes(
      `Set up Alteran project at ${projectDir}`,
    )
  ) {
    throw new Error("Expected setup to initialize an empty target");
  }

  const shellenvOutput = await runZsh(
    `eval "$(${JSON.stringify(Deno.execPath())} run -A ${
      JSON.stringify(ALTERAN_ENTRY_PATH)
    } shellenv ${JSON.stringify(projectDir)})" && test "$ALTERAN_HOME" = ${
      JSON.stringify(join(projectDir, ".runtime"))
    } && test ! -d "$ALTERAN_HOME/env" && alteran help >/dev/null`,
    {
      env: {
        PATH: hostDenoPath(),
      },
    },
  );

  if (!shellenvOutput.success) {
    throw new Error(
      `Expected shellenv activation after setup to succeed. stdout=${
        decode(shellenvOutput.stdout)
      } stderr=${decode(shellenvOutput.stderr)}`,
    );
  }
  },
});
