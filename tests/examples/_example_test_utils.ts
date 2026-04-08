import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  copyDirectory,
  ensureDir,
  exists,
  listDirectSubdirectories,
} from "../../src/alteran/fs.ts";
import { detectPlatform } from "../../src/alteran/platform.ts";
import { startStaticFileServer } from "../bootstrap_fixture.ts";

export const ALTERAN_REPO_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
export const EXAMPLES_DIR = join(ALTERAN_REPO_DIR, "examples");
export const IS_WINDOWS = Deno.build.os === "windows";

const PLATFORM = detectPlatform();
const HOST_DENO_BIN_DIR = dirname(Deno.execPath());
const README_REPO_COPY_EXCLUDES = new Set([
  "activate",
  "activate.bat",
]);
const BOOTSTRAP_EMPTY_FOLDER_EXCLUDES = new Set([
  ".runtime",
  "activate",
  "activate.bat",
  "alteran.json",
  "apps",
  "deno.json",
  "deno.lock",
  "dist",
  "libs",
  "tests",
  "tools",
]);
const STANDALONE_RUNTIME_EXCLUDES = new Set([
  "standalone-clock/.runtime",
  "standalone-clock/app",
  "standalone-clock/app.bat",
  "standalone-clock/dist",
]);

function hostPath(): string {
  return `${HOST_DENO_BIN_DIR}${PLATFORM.pathSeparator}${
    Deno.env.get("PATH") ?? ""
  }`;
}

function hermeticEnv(
  extra: Record<string, string> = {},
): Record<string, string> {
  const source = Deno.env.toObject();
  const env: Record<string, string> = {
    PATH: hostPath(),
  };

  for (
    const key of [
      "HOME",
      "TMPDIR",
      "TMP",
      "TEMP",
      "USER",
      "USERNAME",
      "LANG",
      "LC_ALL",
      "TERM",
      "SYSTEMROOT",
      "SystemRoot",
      "COMSPEC",
      "ComSpec",
      "PATHEXT",
    ]
  ) {
    const value = source[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }

  return {
    ALTERAN_HOME: "",
    ALTERAN_RUN_ID: "",
    ALTERAN_ROOT_RUN_ID: "",
    ALTERAN_PARENT_RUN_ID: "",
    ALTERAN_ROOT_LOG_DIR: "",
    ALTERAN_LOG_MODE: "",
    ALTERAN_LOG_CONTEXT_JSON: "",
    ALTERAN_LOGTAPE_ENABLED: "",
    ...env,
    ...extra,
  };
}

export function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function commandExists(command: string): Promise<boolean> {
  try {
    const output = await new Deno.Command(command, {
      args: ["-v"],
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

async function detectLocalFixtureSkipReason(): Promise<string | null> {
  if (IS_WINDOWS) {
    return "Unix-oriented example/docs helpers are not supported on Windows hosts.";
  }

  if (!(await commandExists("sh"))) {
    return "Example/docs harness requires the host sh shell.";
  }

  if (!(await commandExists("zip"))) {
    return "Local Deno fixture requires the host zip command.";
  }

  const tempDir = await Deno.makeTempDir({ prefix: "alteran-fixture-probe-" });
  try {
    await Deno.writeTextFile(join(tempDir, "index.html"), "probe\n");
    const server = await startStaticFileServer(tempDir);
    await server.close();
    return null;
  } catch (error) {
    if (error instanceof Deno.errors.PermissionDenied) {
      return "Local Deno fixture requires permission to bind a loopback HTTP server.";
    }
    throw error;
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

export const LOCAL_DENO_FIXTURE_SKIP_REASON =
  await detectLocalFixtureSkipReason();
export const REQUIRES_LOCAL_DENO_FIXTURE = !IS_WINDOWS &&
  LOCAL_DENO_FIXTURE_SKIP_REASON === null;
export const REQUIRES_GIT_REPO_COPY = await commandExists("git");

async function rewriteExampleDotEnvForTemp(projectDir: string): Promise<void> {
  const dotEnvPath = join(projectDir, ".env");
  if (!(await exists(dotEnvPath))) {
    return;
  }

  const lines = (await Deno.readTextFile(dotEnvPath)).split(/\r?\n/u);
  let changed = false;
  const nextLines = lines.map((line) => {
    if (!line.startsWith("ALTERAN_SRC=")) {
      return line;
    }
    changed = true;
    const [key] = line.split("=", 1);
    return `${key}=${join(ALTERAN_REPO_DIR, "src")}`;
  });

  if (changed) {
    await Deno.writeTextFile(dotEnvPath, `${nextLines.join("\n").trimEnd()}\n`);
  }
}

export async function copyExampleToTemp(
  exampleRelativePath: string,
): Promise<string> {
  const sourceDir = join(EXAMPLES_DIR, exampleRelativePath);
  const tempParentDir = await Deno.makeTempDir({
    prefix: `alteran-example-${exampleRelativePath.replaceAll("/", "-")}-`,
  });
  const tempDir = join(tempParentDir, "example");

  if (await exists(join(sourceDir, "alteran.json"))) {
    const copy = await runAlteranCli(ALTERAN_REPO_DIR, [
      "compact-copy",
      tempDir,
      `--source=${sourceDir}`,
    ]);
    assertSuccess(copy, `compact-copy example ${exampleRelativePath}`);
  } else {
    await copyDirectory(sourceDir, tempDir, {
      filter: (absolutePath) => {
        const relativePath = absolutePath === sourceDir
          ? ""
          : absolutePath.slice(sourceDir.length + 1).replaceAll("\\", "/");
        if (!relativePath) {
          return true;
        }
        if (relativePath === ".runtime" || relativePath.startsWith(".runtime/")) {
          return false;
        }
        if (
          exampleRelativePath === "01-bootstrap-empty-folder" &&
          (
            BOOTSTRAP_EMPTY_FOLDER_EXCLUDES.has(relativePath) ||
            [...BOOTSTRAP_EMPTY_FOLDER_EXCLUDES].some((entry) =>
              relativePath.startsWith(`${entry}/`)
            )
          )
        ) {
          return false;
        }
        if (
          exampleRelativePath === "advanced/standalone-app-runtime" &&
          (
            STANDALONE_RUNTIME_EXCLUDES.has(relativePath) ||
            [...STANDALONE_RUNTIME_EXCLUDES].some((entry) =>
              relativePath.startsWith(`${entry}/`)
            )
          )
        ) {
          return false;
        }
        return true;
      },
    });
  }

  await rewriteExampleDotEnvForTemp(tempDir);
  return tempDir;
}

export async function runAlteranCli(
  cwd: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<Deno.CommandOutput> {
  return await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", join(ALTERAN_REPO_DIR, "alteran.ts"), ...args],
    cwd,
    env: hermeticEnv(env),
    stdout: "piped",
    stderr: "piped",
  }).output();
}

export async function runLocalDeno(
  cwd: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<Deno.CommandOutput> {
  return await new Deno.Command(Deno.execPath(), {
    args,
    cwd,
    env: hermeticEnv(env),
    stdout: "piped",
    stderr: "piped",
  }).output();
}

export async function runShell(
  script: string,
  env: Record<string, string> = {},
): Promise<Deno.CommandOutput> {
  return await new Deno.Command("sh", {
    args: ["-c", script],
    env: hermeticEnv(env),
    stdout: "piped",
    stderr: "piped",
  }).output();
}

export async function runExampleSetup(
  projectDir: string,
  env: Record<string, string> = {},
): Promise<Deno.CommandOutput> {
  return await runShell(
    `cd ${JSON.stringify(projectDir)} && ./setup >/dev/null`,
    env,
  );
}

export async function runExampleActivated(
  projectDir: string,
  command: string,
  env: Record<string, string> = {},
): Promise<Deno.CommandOutput> {
  return await runShell(
    `cd ${
      JSON.stringify(projectDir)
    } && ./setup >/dev/null && . ./activate >/dev/null && ${command}`,
    env,
  );
}

export function assertSuccess(
  output: Deno.CommandOutput,
  label: string,
): void {
  if (!output.success) {
    throw new Error(
      `${label} failed. stdout=${decode(output.stdout)} stderr=${
        decode(output.stderr)
      }`,
    );
  }
}

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await Deno.readTextFile(path));
}

export async function latestLogDir(
  projectDir: string,
  category: "apps" | "tools" | "runs" | "tasks" | "tests",
): Promise<string> {
  const root = join(projectDir, ".runtime", "logs", category);
  const directories = (await listDirectSubdirectories(root)).sort();
  assert(directories.length > 0, `Expected at least one log dir under ${root}`);
  return join(root, directories.at(-1)!);
}

export async function prepareRepoCopy(): Promise<string> {
  assert(
    REQUIRES_GIT_REPO_COPY,
    "Repository copy fixture requires the host git command.",
  );
  const tempDir = await Deno.makeTempDir({
    prefix: "alteran-readme-quickstart-",
  });

  const trackedFilesOutput = await new Deno.Command("git", {
    args: ["ls-files", "-z"],
    cwd: ALTERAN_REPO_DIR,
    env: hermeticEnv(),
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!trackedFilesOutput.success) {
    throw new Error(
      `Failed to list tracked repository files for README quick start copy. stderr=${
        decode(trackedFilesOutput.stderr)
      }`,
    );
  }

  const trackedFiles = decode(trackedFilesOutput.stdout)
    .split("\0")
    .map((path) => path.trim())
    .filter(Boolean)
    .filter((path) =>
      !path.startsWith(".git/") &&
      !path.startsWith(".runtime/") &&
      !path.startsWith("dist/") &&
      !README_REPO_COPY_EXCLUDES.has(path)
    );

  for (const relativePath of trackedFiles) {
    const sourcePath = join(ALTERAN_REPO_DIR, relativePath);
    const targetPath = join(tempDir, relativePath);
    await ensureDir(dirname(targetPath));
    await Deno.copyFile(sourcePath, targetPath);

    if (Deno.build.os !== "windows") {
      const sourceMode = (await Deno.stat(sourcePath)).mode;
      if (sourceMode !== null) {
        await Deno.chmod(targetPath, sourceMode);
      }
    }
  }

  return tempDir;
}

export async function startLocalDenoFixture(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  assert(
    REQUIRES_LOCAL_DENO_FIXTURE,
    LOCAL_DENO_FIXTURE_SKIP_REASON ??
      "Local Deno fixture support was not initialized.",
  );

  const tempDir = await Deno.makeTempDir({ prefix: "alteran-deno-source-" });
  const releaseRoot = join(tempDir, "release");
  const version = Deno.version.deno.startsWith("v")
    ? Deno.version.deno
    : `v${Deno.version.deno}`;
  const versionDir = join(releaseRoot, version);
  const stagingDir = join(tempDir, "staging");
  const archiveName = `deno-${PLATFORM.archiveTarget}.zip`;

  await Deno.mkdir(versionDir, { recursive: true });
  await Deno.mkdir(stagingDir, { recursive: true });
  await Deno.copyFile(
    Deno.execPath(),
    join(stagingDir, PLATFORM.denoBinaryName),
  );
  if (!IS_WINDOWS) {
    await Deno.chmod(join(stagingDir, PLATFORM.denoBinaryName), 0o755);
  }
  await Deno.writeTextFile(
    join(releaseRoot, "release-latest.txt"),
    `${version}\n`,
  );

  const zipOutput = await new Deno.Command("zip", {
    args: [
      "-jq",
      join(versionDir, archiveName),
      join(stagingDir, PLATFORM.denoBinaryName),
    ],
    stdout: "null",
    stderr: "piped",
  }).output();
  if (!zipOutput.success) {
    throw new Error(
      `Failed to create local Deno archive source: ${decode(zipOutput.stderr)}`,
    );
  }

  const server = await startStaticFileServer(releaseRoot);
  return {
    baseUrl: server.baseUrl,
    close: async () => {
      await server.close();
      await Deno.remove(tempDir, { recursive: true });
    },
  };
}

export async function withLocalDenoSources<T>(
  run: (env: Record<string, string>) => Promise<T>,
): Promise<T> {
  const fixture = await startLocalDenoFixture();
  try {
    return await run({ DENO_SOURCES: fixture.baseUrl });
  } finally {
    await fixture.close();
  }
}
