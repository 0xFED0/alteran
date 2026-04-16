import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { copyDirectory, ensureDir, removeIfExists } from "../src/alteran/fs.ts";
import {
  summarizeEnvKeys,
  TEST_TRACE_CATEGORY,
  traceCommandResult,
  traceCommandStart,
  traceTestStep,
} from "./test_trace.ts";

const ALTERAN_REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IS_WINDOWS = Deno.build.os === "windows";

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function cmdQuote(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function cmdCallBatch(path: string, ...args: string[]): string {
  const renderedArgs = args.map((arg) => ` ${cmdQuote(arg)}`).join("");
  return `call ${cmdQuote(path)}${renderedArgs}`;
}

function cmdCallCommand(command: string, ...args: string[]): string {
  const renderedArgs = args.map((arg) => ` ${arg}`).join("");
  return `call ${command}${renderedArgs}`;
}

function psQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function hostDenoPathWindows(): string {
  return `${dirname(Deno.execPath())};${Deno.env.get("PATH") ?? ""}`;
}

function windowsSystemPath(): string {
  const systemRoot = Deno.env.get("SystemRoot") ?? "C:\\Windows";
  return [
    `${systemRoot}\\System32`,
    systemRoot,
    `${systemRoot}\\System32\\Wbem`,
    `${systemRoot}\\System32\\WindowsPowerShell\\v1.0`,
  ].join(";");
}

function windowsPlatformId(arch: "x64" | "arm64"): string {
  return `windows-${arch}`;
}

function windowsDenoTarget(arch: "x64" | "arm64"): string {
  return arch === "arm64"
    ? "aarch64-pc-windows-msvc"
    : "x86_64-pc-windows-msvc";
}

function currentWindowsArch(): "x64" | "arm64" {
  return Deno.build.arch === "aarch64" ? "arm64" : "x64";
}

function hermeticAlteranEnvWindows(
  env: Record<string, string> = {},
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

async function runCmd(
  script: string,
  options: {
    cwd?: string;
    env?: Record<string, string>;
  } = {},
) {
  const scriptFile = await Deno.makeTempFile({
    prefix: "alteran-win-cmd-",
    suffix: ".cmd",
  });
  try {
    await traceCommandStart(
      TEST_TRACE_CATEGORY.e2eRepoWindows,
      "cmd /d /c call <temp-script>",
      {
        cwd: options.cwd,
        env_keys: summarizeEnvKeys(options.env ?? {}),
      },
    );
    await Deno.writeTextFile(
      scriptFile,
      `@echo off\r\n${script}\r\n`,
    );
    const output = await new Deno.Command("cmd", {
      args: ["/d", "/c", "call", scriptFile],
      cwd: options.cwd,
      env: {
        ...Deno.env.toObject(),
        ...hermeticAlteranEnvWindows(options.env ?? {}),
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    await traceCommandResult(TEST_TRACE_CATEGORY.e2eRepoWindows, output, {
      cwd: options.cwd,
      script_file: scriptFile,
    });
    return output;
  } finally {
    await removeIfExists(scriptFile);
  }
}

function cmdScript(lines: string[]): string {
  return lines.join("\r\n");
}

async function runPowerShell(
  script: string,
  options: {
    cwd?: string;
    env?: Record<string, string>;
  } = {},
) {
  await traceCommandStart(
    TEST_TRACE_CATEGORY.e2eRepoWindows,
    "powershell -Command <script>",
    {
      cwd: options.cwd,
      env_keys: summarizeEnvKeys(options.env ?? {}),
    },
  );
  const output = await new Deno.Command("powershell", {
    args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    cwd: options.cwd,
    env: {
      ...Deno.env.toObject(),
      ...hermeticAlteranEnvWindows(options.env ?? {}),
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  await traceCommandResult(TEST_TRACE_CATEGORY.e2eRepoWindows, output, {
    cwd: options.cwd,
  });
  return output;
}

async function makeDirWithSpaces(
  prefix: string,
  name: string,
): Promise<string> {
  const root = await Deno.makeTempDir({ prefix });
  const result = join(root, name);
  await ensureDir(result);
  return result;
}

async function makeRepoCopyWithSpaces(prefix: string): Promise<string> {
  const copyDir = await makeDirWithSpaces(prefix, "alteran repo with spaces");
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

async function copySetupScripts(targetDir: string): Promise<void> {
  await Deno.copyFile(
    join(ALTERAN_REPO_DIR, "setup"),
    join(targetDir, "setup"),
  );
  await Deno.copyFile(
    join(ALTERAN_REPO_DIR, "setup.bat"),
    join(targetDir, "setup.bat"),
  );
}

async function createDenoZipArchive(
  arch: "x64" | "arm64",
): Promise<Uint8Array> {
  const tempDir = await Deno.makeTempDir({ prefix: "alteran-win-deno-zip-" });
  const denoExePath = join(tempDir, "deno.exe");
  const zipPath = join(tempDir, `deno-${arch}.zip`);
  await Deno.copyFile(Deno.execPath(), denoExePath);

  try {
    const output = await runPowerShell(
      `Compress-Archive -Force -Path ${psQuote(denoExePath)} -DestinationPath ${
        psQuote(zipPath)
      }`,
    );
    if (!output.success) {
      throw new Error(
        `Failed to create Deno archive. stdout=${
          decode(output.stdout)
        } stderr=${decode(output.stderr)}`,
      );
    }
    return await Deno.readFile(zipPath);
  } finally {
    await removeIfExists(tempDir);
  }
}

async function startLocalDenoMirror(arch: "x64" | "arm64"): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  await traceTestStep(
    TEST_TRACE_CATEGORY.e2eRepoWindows,
    "starting local deno mirror",
    {
      arch,
    },
  );
  const version = "v0.0.1-local";
  const archiveTarget = windowsDenoTarget(arch);
  const archiveBytes = await createDenoZipArchive(arch);
  let resolveBaseUrl: ((value: string) => void) | undefined;
  const baseUrlPromise = new Promise<string>((resolve) => {
    resolveBaseUrl = resolve;
  });
  const server = Deno.serve({
    hostname: "127.0.0.1",
    port: 0,
    onListen({ hostname, port }) {
      resolveBaseUrl?.(`http://${hostname}:${port}`);
    },
  }, (request: Request) => {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/release-latest.txt") {
      return new Response(version);
    }
    if (pathname === `/${version}/deno-${archiveTarget}.zip`) {
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(archiveBytes);
            controller.close();
          },
        }),
        {
          headers: { "content-type": "application/zip" },
        },
      );
    }
    return new Response("not found", { status: 404 });
  });
  const baseUrl = await baseUrlPromise;

  return {
    baseUrl,
    close: async () => {
      await traceTestStep(
        TEST_TRACE_CATEGORY.e2eRepoWindows,
        "stopping local deno mirror",
        {
          base_url: baseUrl,
          arch,
        },
      );
      await server.shutdown();
    },
  };
}

function assertSuccess(
  output: Deno.CommandOutput,
  message: string,
): void {
  if (!output.success) {
    throw new Error(
      `${message}. stdout=${decode(output.stdout)} stderr=${
        decode(output.stderr)
      }`,
    );
  }
}

function assertFailureContains(
  output: Deno.CommandOutput,
  expectedText: string,
  message: string,
): void {
  const combined = `${decode(output.stdout)}\n${decode(output.stderr)}`;
  if (output.success || !combined.includes(expectedText)) {
    throw new Error(
      `${message}. stdout=${decode(output.stdout)} stderr=${
        decode(output.stderr)
      }`,
    );
  }
}

async function latestLogDirUnder(
  rootDir: string,
  category: "runs" | "tests" | "tools" | "apps" | "tasks",
): Promise<string> {
  const categoryDir = join(rootDir, category);
  const entries = await Array.fromAsync(Deno.readDir(categoryDir));
  const dirs = entries.filter((entry) => entry.isDirectory)
    .map((entry) => entry.name)
    .sort();
  if (dirs.length === 0) {
    throw new Error(`Expected at least one log dir under ${categoryDir}`);
  }
  return join(categoryDir, dirs.at(-1)!);
}

Deno.test({
  name:
    "windows cmd: generated activate.bat preserves session env and exposes deno/alteran",
  ignore: !IS_WINDOWS,
  async fn() {
    const repoCopy = await makeRepoCopyWithSpaces("alteran-win-repo-env-");
    const targetDir = await makeDirWithSpaces(
      "alteran-win-target-env-",
      "target project with spaces",
    );

    try {
      const output = await runCmd(
        cmdScript([
          cmdCallBatch(join(repoCopy, "setup.bat"), targetDir),
          "if errorlevel 1 exit /b %ERRORLEVEL%",
          cmdCallBatch(join(targetDir, "activate.bat")),
          "if errorlevel 1 exit /b %ERRORLEVEL%",
          `if /I not "%ALTERAN_HOME%"==${
            cmdQuote(join(targetDir, ".runtime"))
          } exit /b 1`,
          "where deno >nul",
          "if errorlevel 1 exit /b %ERRORLEVEL%",
          cmdCallCommand("alteran", "help", ">nul"),
        ]),
        {
          env: {
            PATH: hostDenoPathWindows(),
          },
        },
      );
      assertSuccess(
        output,
        "Expected cmd activation to preserve env and expose managed commands",
      );
    } finally {
      await removeIfExists(repoCopy);
    }
  },
});

Deno.test({
  name: "windows cmd: generated activate.bat exposes alt/atest/adeno aliases",
  ignore: !IS_WINDOWS,
  async fn() {
    const repoCopy = await makeRepoCopyWithSpaces("alteran-win-repo-aliases-");
    const targetDir = await makeDirWithSpaces(
      "alteran-win-target-aliases-",
      "target project with spaces",
    );

    try {
      const output = await runCmd(
        [
          cmdCallBatch(join(repoCopy, "setup.bat"), targetDir),
          cmdCallBatch(join(targetDir, "activate.bat")),
          cmdCallCommand("alt", "help", ">nul"),
          cmdCallCommand("atest", "--help", ">nul"),
          cmdCallCommand("adeno", "--version", ">nul"),
        ].join(" && "),
        {
          env: {
            PATH: hostDenoPathWindows(),
          },
        },
      );
      assertSuccess(
        output,
        "Expected core cmd aliases to work after activation",
      );
    } finally {
      await removeIfExists(repoCopy);
    }
  },
});

Deno.test({
  name:
    "windows cmd: activated alt remains usable after running tests in the same session",
  ignore: !IS_WINDOWS,
  async fn() {
    const repoCopy = await makeRepoCopyWithSpaces("alteran-win-repo-test-reuse-");
    const targetDir = await makeDirWithSpaces(
      "alteran-win-target-test-reuse-",
      "target test reuse with spaces",
    );

    try {
      const setupOutput = await runCmd(
        cmdCallBatch(join(repoCopy, "setup.bat"), targetDir),
        {
          env: {
            PATH: hostDenoPathWindows(),
          },
        },
      );
      assertSuccess(
        setupOutput,
        "Expected setup.bat to initialize the test-reuse target",
      );
      await Deno.mkdir(join(targetDir, "tests"), { recursive: true });
      await Deno.writeTextFile(
        join(targetDir, "tests", "sample_test.ts"),
        'Deno.test("sample", () => {});\n',
      );

      const output = await runCmd(
        [
          cmdCallBatch(join(targetDir, "activate.bat")),
          cmdCallCommand("alt", "test", "-A", "tests/sample_test.ts", ">nul"),
          cmdCallCommand("alt", "help", ">nul"),
          cmdCallCommand("atest", "--help", ">nul"),
        ].join(" && "),
        {
          env: {
            PATH: hostDenoPathWindows(),
          },
        },
      );
      assertSuccess(
        output,
        "Expected activated alt and atest to remain usable after running tests in the same cmd session",
      );
    } finally {
      await removeIfExists(repoCopy);
    }
  },
});

Deno.test({
  name:
    "windows cmd: copied setup.bat supports legacy ALTERAN_SOURCES alias and generates local activation",
  ignore: !IS_WINDOWS,
  async fn() {
    const targetDir = await makeDirWithSpaces(
      "alteran-win-legacy-alias-",
      "copied target with spaces",
    );
    await copySetupScripts(targetDir);

    const alteranSource =
      pathToFileURL(join(ALTERAN_REPO_DIR, "alteran.ts")).href;
    const output = await runCmd(
      [
        cmdCallBatch(join(targetDir, "setup.bat")),
        `if not exist ${
          cmdQuote(join(targetDir, ".runtime", "alteran", "mod.ts"))
        } exit /b 1`,
        `if not exist ${cmdQuote(join(targetDir, "activate.bat"))} exit /b 1`,
        cmdCallBatch(join(targetDir, "activate.bat")),
        cmdCallCommand("alteran", "help", ">nul"),
      ].join(" && "),
      {
        cwd: targetDir,
        env: {
          PATH: hostDenoPathWindows(),
          ALTERAN_SOURCES: alteranSource,
        },
      },
    );
    assertSuccess(
      output,
      "Expected legacy ALTERAN_SOURCES alias to bootstrap copied setup.bat",
    );
  },
});

Deno.test({
  name:
    "windows cmd: copied setup.bat fails fast when both Alteran source lists are empty",
  ignore: !IS_WINDOWS,
  async fn() {
    const targetDir = await makeDirWithSpaces(
      "alteran-win-empty-sources-",
      "empty source target",
    );
    await copySetupScripts(targetDir);

    const output = await runCmd(
      cmdCallBatch(join(targetDir, "setup.bat")),
      {
        cwd: targetDir,
        env: {
          PATH: hostDenoPathWindows(),
          ALTERAN_RUN_SOURCES: "",
          ALTERAN_ARCHIVE_SOURCES: "",
        },
      },
    );

    assertFailureContains(
      output,
      "Failed to bootstrap Alteran. Check your internet connection or extend ALTERAN_RUN_SOURCES / ALTERAN_ARCHIVE_SOURCES.",
      "Expected copied setup.bat to fail fast when both Alteran source lists are empty",
    );
  },
});

Deno.test({
  name:
    "windows powershell: direct & setup.bat initializes target and generates activate.bat",
  ignore: !IS_WINDOWS,
  async fn() {
    const repoCopy = await makeRepoCopyWithSpaces("alteran-win-repo-ps-");
    const targetDir = await makeDirWithSpaces(
      "alteran-win-target-ps-",
      "powershell target with spaces",
    );

    try {
      const output = await runPowerShell(
        [
          `& ${psQuote(join(repoCopy, "setup.bat"))} ${psQuote(targetDir)}`,
          `if (!(Test-Path ${
            psQuote(join(targetDir, ".runtime", "alteran", "mod.ts"))
          })) { exit 1 }`,
          `if (!(Test-Path ${
            psQuote(join(targetDir, "activate.bat"))
          })) { exit 1 }`,
        ].join("; "),
        {
          env: {
            PATH: hostDenoPathWindows(),
          },
        },
      );
      assertSuccess(
        output,
        "Expected PowerShell direct invocation to initialize the target",
      );
    } finally {
      await removeIfExists(repoCopy);
    }
  },
});

Deno.test({
  name:
    "windows powershell: cmd /c call generated activate.bat can activate and run alteran",
  ignore: !IS_WINDOWS,
  async fn() {
    const repoCopy = await makeRepoCopyWithSpaces("alteran-win-repo-ps-cmd-");
    const targetDir = await makeDirWithSpaces(
      "alteran-win-target-ps-cmd-",
      "powershell cmd target with spaces",
    );

    try {
      const output = await runPowerShell(
        `cmd /d /c ${
          psQuote(
            `${cmdCallBatch(join(repoCopy, "setup.bat"), targetDir)} && ${
              cmdCallBatch(join(targetDir, "activate.bat"))
            } && alteran help >nul`,
          )
        }`,
        {
          env: {
            PATH: hostDenoPathWindows(),
          },
        },
      );
      assertSuccess(
        output,
        "Expected PowerShell->cmd bridge activation to keep alteran usable",
      );
    } finally {
      await removeIfExists(repoCopy);
    }
  },
});

Deno.test({
  name:
    "windows cmd: mirror-only DENO_SOURCES can bootstrap local deno without global install",
  ignore: !IS_WINDOWS,
  async fn() {
    const arch: "x64" | "arm64" = Deno.build.arch === "aarch64"
      ? "arm64"
      : "x64";
    const mirror = await startLocalDenoMirror(arch);
    const targetDir = await makeDirWithSpaces(
      "alteran-win-mirror-deno-",
      "mirror deno target with spaces",
    );
    await copySetupScripts(targetDir);

    try {
      const output = await runCmd(
        [
          cmdCallBatch(join(targetDir, "setup.bat")),
          `if not exist ${
            cmdQuote(
              join(
                targetDir,
                ".runtime",
                "deno",
                windowsPlatformId(arch),
                "bin",
                "deno.exe",
              ),
            )
          } exit /b 1`,
          `if not exist ${
            cmdQuote(join(targetDir, ".runtime", "alteran", "mod.ts"))
          } exit /b 1`,
          `if not exist ${cmdQuote(join(targetDir, "activate.bat"))} exit /b 1`,
        ].join(" && "),
        {
          cwd: targetDir,
          env: {
            PATH: windowsSystemPath(),
            DENO_SOURCES: mirror.baseUrl,
            ALTERAN_RUN_SOURCES:
              pathToFileURL(join(ALTERAN_REPO_DIR, "alteran.ts")).href,
          },
        },
      );
      assertSuccess(
        output,
        "Expected mirror-only DENO_SOURCES to be sufficient for bootstrapping local Deno",
      );
    } finally {
      await mirror.close();
    }
  },
});

Deno.test({
  name:
    "windows cmd: generated activate.bat is tied to the concrete local runtime path produced by setup",
  ignore: !IS_WINDOWS,
  async fn() {
    const targetDir = await makeDirWithSpaces(
      "alteran-win-arm64-",
      "activation path target with spaces",
    );

    const repoSetup = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        join(ALTERAN_REPO_DIR, "alteran.ts"),
        "setup",
        targetDir,
      ],
      cwd: ALTERAN_REPO_DIR,
      env: Deno.env.toObject(),
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertSuccess(
      repoSetup,
      "Expected direct setup bootstrap to seed runtime material",
    );

    const activateBat = await Deno.readTextFile(
      join(targetDir, "activate.bat"),
    );
    if (!activateBat.includes(targetDir.replaceAll("/", "\\"))) {
      throw new Error(
        "Expected generated activate.bat to embed the concrete project path",
      );
    }
    if (!activateBat.includes("\\.runtime\\deno\\")) {
      throw new Error(
        "Expected generated activate.bat to embed a concrete local deno runtime path",
      );
    }

    const output = await runCmd(
      cmdScript([
        cmdCallBatch(join(targetDir, "activate.bat")),
        "if errorlevel 1 exit /b %ERRORLEVEL%",
        `if /I not "%ALTERAN_HOME%"==${
          cmdQuote(join(targetDir, ".runtime"))
        } exit /b 1`,
        cmdCallCommand("alteran", "help", ">nul"),
      ]),
      {
        cwd: targetDir,
        env: {
          PATH: hostDenoPathWindows(),
        },
      },
    );

    assertSuccess(
      output,
      "Expected generated activate.bat to activate through its concrete local runtime path",
    );
  },
});

Deno.test({
  name:
    "windows cmd: activated alteran clean runtime uses deferred cleanup batch and preserves the active managed deno binary",
  ignore: !IS_WINDOWS,
  async fn() {
    const targetDir = await makeDirWithSpaces(
      "alteran-win-clean-runtime-",
      "clean runtime target with spaces",
    );
    const arch = currentWindowsArch();
    const managedDenoPath = join(
      targetDir,
      ".runtime",
      "deno",
      windowsPlatformId(arch),
      "bin",
      "deno.exe",
    );

    const repoSetup = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        join(ALTERAN_REPO_DIR, "alteran.ts"),
        "setup",
        targetDir,
      ],
      cwd: ALTERAN_REPO_DIR,
      env: hermeticAlteranEnvWindows({
        PATH: hostDenoPathWindows(),
      }),
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertSuccess(
      repoSetup,
      "Expected direct setup bootstrap to seed runtime material",
    );

    await Deno.mkdir(join(targetDir, ".runtime", "legacy-junk"), {
      recursive: true,
    });
    await Deno.writeTextFile(
      join(targetDir, ".runtime", "legacy-junk", "marker.txt"),
      "junk",
    );
    await Deno.mkdir(join(targetDir, ".runtime", "logs"), { recursive: true });
    await Deno.writeTextFile(
      join(targetDir, ".runtime", "logs", "old.log"),
      "old",
    );

    const output = await runCmd(
      [
        cmdCallBatch(join(targetDir, "activate.bat")),
        cmdCallCommand("alteran", "clean", "runtime"),
      ].join(" && "),
      {
        cwd: targetDir,
        env: {
          PATH: hostDenoPathWindows(),
        },
      },
    );
    assertSuccess(
      output,
      "Expected activated Windows alteran clean runtime to succeed",
    );
    const combined = `${decode(output.stdout)}\n${decode(output.stderr)}`;
    if (!combined.includes("[handoff]")) {
      throw new Error(
        `Expected Windows clean runtime to use deferred cleanup batch. stdout=${
          decode(output.stdout)
        } stderr=${decode(output.stderr)}`,
      );
    }

    await Deno.stat(managedDenoPath);
    await Deno.stat(join(targetDir, ".runtime", "alteran", "mod.ts"));
    await Deno.stat(join(targetDir, ".runtime", "tools"));
    await Deno.stat(join(targetDir, ".runtime", "libs"));

    try {
      await Deno.stat(join(targetDir, ".runtime", "legacy-junk"));
      throw new Error(
        "Expected deferred clean runtime to remove legacy runtime entries",
      );
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    await Deno.stat(join(targetDir, ".runtime", "logs"));
    try {
      await Deno.stat(join(targetDir, ".runtime", "logs", "old.log"));
      throw new Error("Expected clean runtime to remove stale log files");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  },
});

Deno.test({
  name:
    "windows cmd: activated alteran clean builds removes dist without deferred cleanup batch artifacts",
  ignore: !IS_WINDOWS,
  async fn() {
    const targetDir = await makeDirWithSpaces(
      "alteran-win-clean-builds-",
      "clean builds target with spaces",
    );

    const repoSetup = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        join(ALTERAN_REPO_DIR, "alteran.ts"),
        "setup",
        targetDir,
      ],
      cwd: ALTERAN_REPO_DIR,
      env: hermeticAlteranEnvWindows({
        PATH: hostDenoPathWindows(),
      }),
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertSuccess(
      repoSetup,
      "Expected direct setup bootstrap to seed runtime material",
    );

    await Deno.mkdir(join(targetDir, "dist", "jsr"), { recursive: true });
    await Deno.writeTextFile(
      join(targetDir, "dist", "jsr", "artifact.txt"),
      "dist",
    );

    const output = await runCmd(
      [
        cmdCallBatch(join(targetDir, "activate.bat")),
        cmdCallCommand("alteran", "clean", "builds"),
      ].join(" && "),
      {
        cwd: targetDir,
        env: {
          PATH: hostDenoPathWindows(),
        },
      },
    );
    assertSuccess(
      output,
      "Expected activated Windows alteran clean builds to succeed",
    );
    const combined = `${decode(output.stdout)}\n${decode(output.stderr)}`;
    if (combined.includes("[handoff]")) {
      throw new Error(
        `Expected Windows clean builds not to use deferred cleanup batch. stdout=${
          decode(output.stdout)
        } stderr=${decode(output.stderr)}`,
      );
    }

    try {
      await Deno.stat(join(targetDir, "dist"));
      throw new Error("Expected clean builds to remove dist");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  },
});

Deno.test({
  name:
    "windows cmd: activated alteran compact -y uses deferred cleanup batch and leaves the project compacted before returning",
  ignore: !IS_WINDOWS,
  async fn() {
    const targetDir = await makeDirWithSpaces(
      "alteran-win-compact-",
      "compact target with spaces",
    );

    const repoSetup = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        join(ALTERAN_REPO_DIR, "alteran.ts"),
        "setup",
        targetDir,
      ],
      cwd: ALTERAN_REPO_DIR,
      env: hermeticAlteranEnvWindows({
        PATH: hostDenoPathWindows(),
      }),
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertSuccess(
      repoSetup,
      "Expected direct setup bootstrap to seed runtime material",
    );

    await Deno.mkdir(join(targetDir, "apps", "demo", ".runtime"), {
      recursive: true,
    });
    await Deno.writeTextFile(
      join(targetDir, "apps", "demo", ".runtime", "marker.txt"),
      "demo",
    );
    await Deno.mkdir(join(targetDir, "dist", "jsr"), { recursive: true });
    await Deno.writeTextFile(
      join(targetDir, "dist", "jsr", "artifact.txt"),
      "dist",
    );

    const output = await runCmd(
      [
        cmdCallBatch(join(targetDir, "activate.bat")),
        cmdCallCommand("alteran", "compact", "-y"),
      ].join(" && "),
      {
        cwd: targetDir,
        env: {
          PATH: hostDenoPathWindows(),
        },
      },
    );
    assertSuccess(
      output,
      "Expected activated Windows alteran compact -y to succeed",
    );
    const combined = `${decode(output.stdout)}\n${decode(output.stderr)}`;
    if (!combined.includes("[handoff]")) {
      throw new Error(
        `Expected Windows compact to use deferred cleanup batch. stdout=${
          decode(output.stdout)
        } stderr=${decode(output.stderr)}`,
      );
    }

    for (
      const removedPath of [
        join(targetDir, ".runtime"),
        join(targetDir, "dist"),
        join(targetDir, "apps", "demo", ".runtime"),
      ]
    ) {
      try {
        await Deno.stat(removedPath);
        throw new Error(
          `Expected ${removedPath} to be absent after Windows compact completed`,
        );
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
          throw error;
        }
      }
    }

    for (
      const preservedPath of [
        join(targetDir, "setup"),
        join(targetDir, "setup.bat"),
        join(targetDir, "alteran.json"),
        join(targetDir, "deno.json"),
        join(targetDir, ".gitignore"),
        join(targetDir, "apps"),
        join(targetDir, "tools"),
        join(targetDir, "libs"),
        join(targetDir, "tests"),
      ]
    ) {
      await Deno.stat(preservedPath);
    }
  },
});

Deno.test({
  name:
    "windows cmd: activated alt compact -y leaves no batch tail after runtime removal",
  ignore: !IS_WINDOWS,
  async fn() {
    const targetDir = await makeDirWithSpaces(
      "alteran-win-alt-compact-",
      "alt compact target with spaces",
    );

    const repoSetup = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        join(ALTERAN_REPO_DIR, "alteran.ts"),
        "setup",
        targetDir,
      ],
      cwd: ALTERAN_REPO_DIR,
      env: hermeticAlteranEnvWindows({
        PATH: hostDenoPathWindows(),
      }),
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertSuccess(
      repoSetup,
      "Expected direct setup bootstrap to seed runtime material for alt compact",
    );

    await Deno.mkdir(join(targetDir, "apps", "demo", ".runtime"), {
      recursive: true,
    });
    await Deno.writeTextFile(
      join(targetDir, "apps", "demo", ".runtime", "marker.txt"),
      "demo",
    );
    await Deno.mkdir(join(targetDir, "dist", "jsr"), { recursive: true });
    await Deno.writeTextFile(
      join(targetDir, "dist", "jsr", "artifact.txt"),
      "dist",
    );

    const output = await runCmd(
      [
        cmdCallBatch(join(targetDir, "activate.bat")),
        cmdCallCommand("alt", "compact", "-y"),
      ].join(" && "),
      {
        cwd: targetDir,
        env: {
          PATH: hostDenoPathWindows(),
        },
      },
    );
    assertSuccess(
      output,
      "Expected activated Windows alt compact -y to succeed without batch tail errors",
    );
    const combined = `${decode(output.stdout)}\n${decode(output.stderr)}`;
    if (combined.includes("Системе не удается найти указанный путь.")) {
      throw new Error(
        `Expected alt compact not to emit a trailing cmd path error. stdout=${
          decode(output.stdout)
        } stderr=${decode(output.stderr)}`,
      );
    }
  },
});
