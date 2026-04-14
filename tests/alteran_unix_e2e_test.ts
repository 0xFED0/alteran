import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runCli } from "../src/alteran/mod.ts";
import { addApp, setupProject } from "../src/alteran/runtime.ts";
import { copyDirectory, removeIfExists } from "../src/alteran/fs.ts";
import { detectPlatform } from "../src/alteran/platform.ts";
import {
  summarizeEnvKeys,
  TEST_TRACE_CATEGORY,
  traceCommandResult,
  traceCommandStart,
  traceTestStep,
  traceTestWarning,
} from "./test_trace.ts";
import {
  prepareBootstrapFixture,
  startStaticFileServer,
} from "./bootstrap_fixture.ts";

const ALTERAN_REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALTERAN_ENTRY_PATH = join(ALTERAN_REPO_DIR, "alteran.ts");
const IS_WINDOWS = Deno.build.os === "windows";

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    Deno.env.delete(key);
    return;
  }
  Deno.env.set(key, value);
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
  await Deno.copyFile(
    Deno.execPath(),
    join(stagingDir, platform.denoBinaryName),
  );
  await Deno.chmod(join(stagingDir, platform.denoBinaryName), 0o755);
  await Deno.writeTextFile(
    join(releaseRoot, "release-latest.txt"),
    `${normalizedVersion}\n`,
  );

  const zipOutput = await new Deno.Command("zip", {
    args: [
      "-jq",
      join(versionDir, archiveName),
      join(stagingDir, platform.denoBinaryName),
    ],
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
  await Deno.chmod(denoPath, 0o755);
}

function hermeticAlteranEnv(
  env: Record<string, string>,
): Record<string, string> {
  return {
    ...env,
    ALTERAN_SRC: "",
    ALTERAN_HOME: "",
    ALTERAN_RUN_ID: "",
    ALTERAN_ROOT_RUN_ID: "",
    ALTERAN_PARENT_RUN_ID: "",
    ALTERAN_ROOT_LOG_DIR: "",
    ALTERAN_LOG_MODE: "",
    ALTERAN_LOG_CONTEXT_JSON: "",
    ALTERAN_LOGTAPE_ENABLED: "",
    ALTERAN_POSTRUN_SESSION_FILE: "",
  };
}

async function runShell(
  script: string,
  options: {
    cwd?: string;
    env?: Record<string, string>;
  } = {},
) {
  await traceCommandStart(TEST_TRACE_CATEGORY.e2eRepoUnix, `sh -c ${script}`, {
    cwd: options.cwd,
    env_keys: summarizeEnvKeys(options.env ?? {}),
  });
  const output = await new Deno.Command("sh", {
    args: ["-c", script],
    cwd: options.cwd,
    env: {
      ...Deno.env.toObject(),
      ...hermeticAlteranEnv(options.env ?? {}),
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  await traceCommandResult(TEST_TRACE_CATEGORY.e2eRepoUnix, output, {
    cwd: options.cwd,
  });
  return output;
}

async function tryStartFixtureServer(rootDir: string): Promise<
  {
    baseUrl: string;
    close: () => Promise<void>;
  } | null
> {
  try {
    await traceTestStep(
      TEST_TRACE_CATEGORY.e2eRepoUnix,
      "starting local fixture server",
      {
        root_dir: rootDir,
      },
    );
    return await startStaticFileServer(rootDir);
  } catch (error) {
    if (error instanceof Deno.errors.PermissionDenied) {
      await traceTestWarning(
        TEST_TRACE_CATEGORY.e2eRepoUnix,
        "local fixture server unavailable",
        {
          root_dir: rootDir,
          reason: "permission denied while binding loopback server",
        },
      );
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

async function commandExists(command: string): Promise<boolean> {
  try {
    const output = await new Deno.Command(command, {
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

async function assertSuccessfulShellActivation(
  activationCommand: string,
  targetDir: string,
  env: Record<string, string>,
): Promise<void> {
  const output = await runShell(
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

async function resolveNodeBridgeArgsPrefix(): Promise<string[] | null> {
  if (!(await isNodeAvailable())) {
    return null;
  }

  try {
    const plainOutput = await new Deno.Command("node", {
      args: [ALTERAN_ENTRY_PATH, "--help"],
      cwd: ALTERAN_REPO_DIR,
      env: {
        ...Deno.env.toObject(),
        PATH: `${dirname(Deno.execPath())}:${Deno.env.get("PATH") ?? ""}`,
      },
      stdout: "null",
      stderr: "null",
    }).output();
    if (plainOutput.success) {
      return [];
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
    return null;
  }

  try {
    const stripTypesOutput = await new Deno.Command("node", {
      args: ["--experimental-strip-types", ALTERAN_ENTRY_PATH, "--help"],
      cwd: ALTERAN_REPO_DIR,
      env: {
        ...Deno.env.toObject(),
        PATH: `${dirname(Deno.execPath())}:${Deno.env.get("PATH") ?? ""}`,
      },
      stdout: "null",
      stderr: "null",
    }).output();
    if (stripTypesOutput.success) {
      return ["--experimental-strip-types"];
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
    return null;
  }

  return null;
}

const NODE_BRIDGE_ARGS_PREFIX = await resolveNodeBridgeArgsPrefix();
const NODE_AVAILABLE = NODE_BRIDGE_ARGS_PREFIX !== null;
const ZSH_AVAILABLE = await commandExists("zsh");

Deno.test({
  name: "managed app launcher runs from another working directory",
  ignore: IS_WINDOWS,
  async fn() {
    const projectDir = await Deno.makeTempDir({
      prefix: "alteran-managed-app-",
    });
    await seedManagedDeno(projectDir);
    await setupProject(projectDir);
    await addApp(projectDir, "hello");

    const output = await runShell(
      `cd /tmp && ${
        JSON.stringify(join(projectDir, "apps", "hello", "app"))
      } one two`,
      {
        env: {
          PATH: hostDenoPath(),
        },
      },
    );

    if (!output.success) {
      throw new Error(
        `Expected managed app launcher to succeed. stdout=${
          decode(output.stdout)
        } stderr=${decode(output.stderr)}`,
      );
    }

    const stdout = decode(output.stdout);
    if (!stdout.includes("App hello started")) {
      throw new Error(`Expected managed app launcher stdout, got: ${stdout}`);
    }
    if (!stdout.includes("one") || !stdout.includes("two")) {
      throw new Error(
        `Expected managed app launcher args to propagate, got: ${stdout}`,
      );
    }
  },
});

Deno.test({
  name:
    "managed app launcher can bootstrap the managed project when runtime is missing",
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
    await setupProject(projectDir);
    await addApp(projectDir, "hello");
    await removeIfExists(join(projectDir, ".runtime"));

    try {
      const output = await runShell(
        `cd /tmp && ${
          JSON.stringify(join(projectDir, "apps", "hello", "app"))
        } alpha beta`,
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
          `Expected managed app launcher to bootstrap missing runtime. stdout=${
            decode(output.stdout)
          } stderr=${decode(output.stderr)}`,
        );
      }

      await Deno.stat(join(projectDir, ".runtime", "alteran", "mod.ts"));
      const stdout = decode(output.stdout);
      if (!stdout.includes("App hello started")) {
        throw new Error(
          `Expected managed app bootstrap launcher stdout, got: ${stdout}`,
        );
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
    await setupProject(projectDir);
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

    const output = await runShell(
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
      throw new Error(`Expected clear app id mismatch error, got: ${stderr}`);
    }
  },
});

Deno.test({
  name: "standalone app launcher auto-runs local setup when runtime is missing",
  ignore: IS_WINDOWS,
  async fn() {
    const appDir = await Deno.makeTempDir({
      prefix: "alteran-standalone-app-",
    });
    const localDenoReleaseDir = await createLocalDenoReleaseDir();
    const localDenoServer = await tryStartFixtureServer(localDenoReleaseDir);
    if (localDenoServer === null) {
      await removeIfExists(dirname(localDenoReleaseDir));
      return;
    }
    const exitCode = await runCli(["app", "setup", appDir]);
    if (exitCode !== 0) {
      throw new Error(
        `Expected standalone app scaffold to be created, got exit code ${exitCode}`,
      );
    }

    const standaloneGitignore = await Deno.readTextFile(
      join(appDir, ".gitignore"),
    );
    for (const expected of [".runtime/", "app", "app.bat"]) {
      if (!standaloneGitignore.includes(expected)) {
        throw new Error(
          `Expected standalone app .gitignore to include ${expected}`,
        );
      }
    }
    for (const unexpected of ["setup", "setup.bat"]) {
      if (standaloneGitignore.includes(unexpected)) {
        throw new Error(
          `Expected standalone app .gitignore not to ignore ${unexpected}`,
        );
      }
    }

    await removeIfExists(join(appDir, ".runtime"));

    try {
      const output = await runShell(
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
          `Expected standalone app launcher to auto-setup and succeed. stdout=${
            decode(output.stdout)
          } stderr=${decode(output.stderr)}`,
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
        throw new Error(
          `Expected standalone app launcher stdout, got: ${stdout}`,
        );
      }
      if (!stdout.includes("red") || !stdout.includes("blue")) {
        throw new Error(
          `Expected standalone app launcher args to propagate, got: ${stdout}`,
        );
      }
    } finally {
      await localDenoServer.close();
      await removeIfExists(dirname(localDenoReleaseDir));
    }
  },
});

Deno.test({
  name: "sourced activate does not leak nounset into the caller shell",
  ignore: IS_WINDOWS || !ZSH_AVAILABLE,
  async fn() {
    const projectDir = await Deno.makeTempDir({ prefix: "alteran-activate-" });
    await setupProject(projectDir);

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
    const stdout = decode(output.stdout).trim();
    const stderr = decode(output.stderr).trim();

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
  name:
    "repeated sourced activate does not reinitialize an initialized project",
  ignore: IS_WINDOWS || !ZSH_AVAILABLE,
  async fn() {
    const projectDir = await Deno.makeTempDir({
      prefix: "alteran-activate-quiet-",
    });
    await setupProject(projectDir);

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
    const stdout = decode(output.stdout);
    const stderr = decode(output.stderr).trim();

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

Deno.test({
  name:
    "activated alteran clean runtime uses deferred postrun and preserves the active managed deno binary",
  ignore: IS_WINDOWS,
  async fn() {
    const projectDir = await Deno.makeTempDir({
      prefix: "alteran-runtime-clean-postrun-",
    });
    await setupProject(projectDir);

    const platform = detectPlatform();
    const activeManagedDeno = join(
      projectDir,
      ".runtime",
      "deno",
      platform.id,
      "bin",
      platform.denoBinaryName,
    );

    await Deno.mkdir(join(projectDir, ".runtime", "legacy-junk"), {
      recursive: true,
    });
    await Deno.writeTextFile(
      join(projectDir, ".runtime", "legacy-junk", "marker.txt"),
      "junk",
    );
    await Deno.mkdir(join(projectDir, ".runtime", "logs"), { recursive: true });
    await Deno.writeTextFile(
      join(projectDir, ".runtime", "logs", "old.log"),
      "old",
    );

    const output = await runShell(
      `cd ${
        JSON.stringify(projectDir)
      } && . ./activate >/dev/null 2>/dev/null && alteran clean runtime`,
      {
        env: {
          PATH: hostDenoPath(),
        },
      },
    );

    if (!output.success) {
      throw new Error(
        `Expected activated alteran clean runtime to succeed. stdout=${
          decode(output.stdout)
        } stderr=${decode(output.stderr)}`,
      );
    }

    await Deno.stat(activeManagedDeno);
    await Deno.stat(join(projectDir, ".runtime", "alteran", "mod.ts"));
    await Deno.stat(join(projectDir, ".runtime", "tools"));
    await Deno.stat(join(projectDir, ".runtime", "libs"));

    try {
      await Deno.stat(join(projectDir, ".runtime", "legacy-junk"));
      throw new Error(
        "Expected deferred clean runtime to remove legacy runtime entries",
      );
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    try {
      await Deno.stat(join(projectDir, ".runtime", "logs"));
      throw new Error("Expected deferred clean runtime to remove logs");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  },
});

Deno.test({
  name:
    "activated alteran clean builds persists postrun artifacts and removes the completed hook dir",
  ignore: IS_WINDOWS,
  async fn() {
    const projectDir = await Deno.makeTempDir({
      prefix: "alteran-clean-builds-postrun-",
    });
    await setupProject(projectDir);

    await Deno.mkdir(join(projectDir, "dist", "jsr"), { recursive: true });
    await Deno.writeTextFile(
      join(projectDir, "dist", "jsr", "artifact.txt"),
      "dist",
    );

    const output = await runShell(
      `cd ${
        JSON.stringify(projectDir)
      } && . ./activate >/dev/null 2>/dev/null && alteran clean builds`,
      {
        env: {
          PATH: hostDenoPath(),
        },
      },
    );

    if (!output.success) {
      throw new Error(
        `Expected activated alteran clean builds to succeed. stdout=${
          decode(output.stdout)
        } stderr=${decode(output.stderr)}`,
      );
    }

    try {
      await Deno.stat(join(projectDir, "dist"));
      throw new Error("Expected deferred clean builds to remove dist");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    const logDir = await latestProjectLogDir(projectDir, "runs");
    const postrunLog = await Deno.readTextFile(join(logDir, "postrun.log"));
    if (
      !(
        postrunLog.includes("intent: clean-builds") &&
        postrunLog.includes("--- begin postrun script ---") &&
        postrunLog.includes("remove_path_checked")
      )
    ) {
      throw new Error(
        "Expected postrun.log to capture the clean-builds intent, script body, and execution trace",
      );
    }
    await Deno.stat(join(logDir, "postrun.msg"));

    const sessionDir = logDir.split(/[/\\]/u).at(-1)!;
    try {
      await Deno.stat(join(projectDir, ".runtime", "hooks", sessionDir));
      throw new Error(
        "Expected successful postrun execution to remove the completed hook dir",
      );
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  },
});

Deno.test({
  name:
    "activated alteran compact -y uses deferred postrun and leaves the project compacted before returning",
  ignore: IS_WINDOWS,
  async fn() {
    const projectDir = await Deno.makeTempDir({
      prefix: "alteran-compact-postrun-",
    });
    await setupProject(projectDir);

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

    const output = await runShell(
      `cd ${
        JSON.stringify(projectDir)
      } && . ./activate >/dev/null 2>/dev/null && alteran compact -y`,
      {
        env: {
          PATH: hostDenoPath(),
        },
      },
    );

    if (!output.success) {
      throw new Error(
        `Expected activated alteran compact -y to succeed. stdout=${
          decode(output.stdout)
        } stderr=${decode(output.stderr)}`,
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
        throw new Error(
          `Expected ${removedPath} to be absent after deferred compact completed`,
        );
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
  },
});

Deno.test({
  name: "node compatibility bridge can show CLI help",
  ignore: !NODE_AVAILABLE,
  async fn() {
    const command = new Deno.Command("node", {
      args: [...NODE_BRIDGE_ARGS_PREFIX!, ALTERAN_ENTRY_PATH, "--help"],
      cwd: ALTERAN_REPO_DIR,
      env: {
        ...Deno.env.toObject(),
        PATH: `${dirname(Deno.execPath())}:${Deno.env.get("PATH") ?? ""}`,
      },
      stdout: "piped",
      stderr: "piped",
    });
    const output = await command.output();
    const stdout = decode(output.stdout);
    const stderr = decode(output.stderr);

    if (!output.success) {
      throw new Error(
        `Expected node bridge help to succeed. stdout=${stdout} stderr=${stderr}`,
      );
    }
    if (
      !stdout.includes("Alteran") || !stdout.includes("alteran setup [dir]")
    ) {
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
    const projectDir = await Deno.makeTempDir({
      prefix: "alteran-node-setup-",
    });
    const command = new Deno.Command("node", {
      args: [
        ...NODE_BRIDGE_ARGS_PREFIX!,
        ALTERAN_ENTRY_PATH,
        "setup",
        projectDir,
      ],
      cwd: ALTERAN_REPO_DIR,
      env: {
        ...Deno.env.toObject(),
        PATH: `${dirname(Deno.execPath())}:${Deno.env.get("PATH") ?? ""}`,
      },
      stdout: "piped",
      stderr: "piped",
    });
    const output = await command.output();
    const stdout = decode(output.stdout);
    const stderr = decode(output.stderr);

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
  name:
    "copied setup bootstraps an empty project directory and generates local activation",
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
      throw new Error(
        "Expected copied setup bootstrap not to generate .runtime/env",
      );
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  },
});

Deno.test({
  name:
    "copied setup can bootstrap from hosted runnable source when archive source is also available",
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
        `cd ${
          JSON.stringify(projectDir)
        } && ./setup >/dev/null && . ./activate`,
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
  name:
    "hosted runnable source alone fails because archive sources are required for materialization",
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

      const output = await runShell(
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
        `cd ${
          JSON.stringify(projectDir)
        } && ./setup >/dev/null && . ./activate`,
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
  name:
    "repository setup can initialize an explicit target directory and generated activate can then be sourced",
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
  name:
    "activated repository environment can set up an external target project",
  ignore: IS_WINDOWS,
  async fn() {
    const repoCopy = await makeRepoCopy("alteran-repo-env-");
    const projectDir = await Deno.makeTempDir({
      prefix: "alteran-repo-env-target-",
    });

    try {
      const initOutput = await runShell(
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

    const shellenvOutput = await runShell(
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

Deno.test({
  name: "alteran compact-copy output is rehydratable on Unix hosts",
  ignore: IS_WINDOWS,
  async fn() {
    const sourceDir = await Deno.makeTempDir({
      prefix: "alteran-compact-copy-rehydrate-source-",
    });
    const destinationRoot = await Deno.makeTempDir({
      prefix: "alteran-compact-copy-rehydrate-destination-",
    });
    const copyDir = join(destinationRoot, "portable-copy");

    await setupProject(sourceDir);

    const previousAlteranHome = Deno.env.get("ALTERAN_HOME");
    Deno.env.delete("ALTERAN_HOME");

    try {
      const exitCode = await runCli([
        "compact-copy",
        copyDir,
        `--source=${sourceDir}`,
      ]);
      if (exitCode !== 0) {
        throw new Error(`Expected compact-copy to succeed, got ${exitCode}`);
      }

      const output = await runShell(
        `cd ${
          JSON.stringify(copyDir)
        } && ./setup >/dev/null 2>/dev/null && . ./activate >/dev/null 2>/dev/null && test -f .runtime/alteran/mod.ts && test ! -d .runtime/env`,
        {
          env: {
            ALTERAN_RUN_SOURCES: ALTERAN_ENTRY_PATH,
            PATH: hostDenoPath(),
          },
        },
      );
      if (!output.success) {
        throw new Error(
          `Expected compact-copy output to be rehydratable. stdout=${
            decode(output.stdout)
          } stderr=${decode(output.stderr)}`,
        );
      }
    } finally {
      restoreEnv("ALTERAN_HOME", previousAlteranHome);
    }
  },
});
