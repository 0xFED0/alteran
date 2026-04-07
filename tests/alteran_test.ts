import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getVersionedJsrDistDir } from "../tools/prepare_jsr/mod.ts";
import {
  getReleaseZipPath,
  getVersionedZipDistDir,
} from "../tools/prepare_zip/mod.ts";
import { runCli } from "../src/alteran/mod.ts";
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

const ALTERAN_REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALTERAN_ENTRY_PATH = join(ALTERAN_REPO_DIR, "alteran.ts");

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

Deno.test("initProject creates core Alteran layout", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-init-" });
  await initProject(projectDir);

  for (
    const path of [
      "alteran.json",
      "deno.json",
      "activate",
      "activate.bat",
      ".gitignore",
      ".runtime/alteran/mod.ts",
      ".runtime/env/enter-env.sh",
      ".runtime/env/enter-env.bat",
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

  const shellenv = await Deno.readTextFile(
    join(projectDir, ".runtime", "env", "enter-env.sh"),
  );
  if (!shellenv.includes(".runtime/deno/")) {
    throw new Error(
      "Expected shellenv to point Deno runtime into .runtime/deno/",
    );
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

Deno.test("sourced activate does not leak nounset into the caller shell", async () => {
  if (Deno.build.os === "windows") {
    return;
  }

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

    if (
      appHelpExitCode !== 0 || cleanHelpExitCode !== 0 ||
      cleanNoScopeExitCode !== 0
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

Deno.test("alteran clean accepts multiple scopes", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-clean-" });
  await initProject(projectDir);

  const envDir = join(projectDir, ".runtime", "env");
  const logsDir = join(projectDir, ".runtime", "logs");
  await Deno.writeTextFile(join(envDir, "custom.tmp"), "env");
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

    const envEntries = await Array.fromAsync(Deno.readDir(envDir));
    const logEntries = await Array.fromAsync(Deno.readDir(logsDir));
    if (envEntries.some((entry) => entry.name === "custom.tmp")) {
      throw new Error("Expected env scope to remove custom env artifacts");
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
    await Deno.stat(join(projectDir, ".runtime", "env"));
    await Deno.stat(runtimeTool);
    await Deno.stat(runtimeLib);
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
        join(projectDir, "activate"),
        join(projectDir, "activate.bat"),
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
          } && . ./activate >/dev/null 2>/dev/null && test -f .runtime/alteran/mod.ts && test -f .runtime/env/enter-env.sh`,
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

Deno.test("node compatibility bridge can show CLI help", async () => {
  if (Deno.build.os === "windows" || !(await isNodeAvailable())) {
    return;
  }

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
  if (!stdout.includes("Alteran") || !stdout.includes("alteran init [dir]")) {
    throw new Error(
      `Expected Alteran help output from node bridge, got: ${stdout}`,
    );
  }
});

Deno.test("node compatibility bridge can initialize a project through Deno", async () => {
  if (Deno.build.os === "windows" || !(await isNodeAvailable())) {
    return;
  }

  const projectDir = await Deno.makeTempDir({ prefix: "alteran-node-init-" });
  const command = new Deno.Command("node", {
    args: [ALTERAN_ENTRY_PATH, "init", projectDir],
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
      `Expected node bridge init to succeed. stdout=${stdout} stderr=${stderr}`,
    );
  }

  for (
    const expectedPath of [
      join(projectDir, "activate"),
      join(projectDir, "activate.bat"),
      join(projectDir, "alteran.json"),
      join(projectDir, "deno.json"),
      join(projectDir, ".runtime", "alteran", "mod.ts"),
    ]
  ) {
    await Deno.stat(expectedPath);
  }
});
