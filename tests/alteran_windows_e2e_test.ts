import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { copyDirectory, ensureDir, removeIfExists } from "../src/alteran/fs.ts";

const ALTERAN_REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IS_WINDOWS = Deno.build.os === "windows";

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function cmdQuote(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
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

async function runCmd(
  script: string,
  options: {
    cwd?: string;
    env?: Record<string, string>;
  } = {},
) {
  return await new Deno.Command("cmd", {
    args: ["/d", "/c", script],
    cwd: options.cwd,
    env: {
      ...Deno.env.toObject(),
      ...options.env,
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
}

async function runPowerShell(
  script: string,
  options: {
    cwd?: string;
    env?: Record<string, string>;
  } = {},
) {
  return await new Deno.Command("powershell", {
    args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    cwd: options.cwd,
    env: {
      ...Deno.env.toObject(),
      ...options.env,
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
}

async function makeDirWithSpaces(prefix: string, name: string): Promise<string> {
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

async function copyActivateScripts(targetDir: string): Promise<void> {
  await Deno.copyFile(join(ALTERAN_REPO_DIR, "activate"), join(targetDir, "activate"));
  await Deno.copyFile(
    join(ALTERAN_REPO_DIR, "activate.bat"),
    join(targetDir, "activate.bat"),
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
        `Failed to create Deno archive. stdout=${decode(output.stdout)} stderr=${
          decode(output.stderr)
        }`,
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
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(archiveBytes);
          controller.close();
        },
      }), {
        headers: { "content-type": "application/zip" },
      });
    }
    return new Response("not found", { status: 404 });
  });
  const baseUrl = await baseUrlPromise;

  return {
    baseUrl,
    close: async () => {
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

Deno.test({
  name: "windows cmd: call activate.bat preserves session env and exposes deno/alteran",
  ignore: !IS_WINDOWS,
  async fn() {
  const repoCopy = await makeRepoCopyWithSpaces("alteran-win-repo-env-");
  const targetDir = await makeDirWithSpaces(
    "alteran-win-target-env-",
    "target project with spaces",
  );

  try {
    const output = await runCmd(
      [
        `call ${cmdQuote(join(repoCopy, "activate.bat"))} ${cmdQuote(targetDir)}`,
        `if /I not "%ALTERAN_HOME%"==${cmdQuote(join(targetDir, ".runtime"))} exit /b 1`,
        "where deno >nul",
        "alteran help >nul",
      ].join(" && "),
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
  name: "windows cmd: enter-env aliases alt/atest/adeno work after activation",
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
        `call ${cmdQuote(join(repoCopy, "activate.bat"))} ${cmdQuote(targetDir)}`,
        "alt help >nul",
        "atest --help >nul",
        "adeno --version >nul",
      ].join(" && "),
      {
        env: {
          PATH: hostDenoPathWindows(),
        },
      },
    );
    assertSuccess(output, "Expected core cmd aliases to work after activation");
  } finally {
    await removeIfExists(repoCopy);
  }
  },
});

Deno.test({
  name: "windows cmd: copied activate.bat supports legacy ALTERAN_SOURCES alias",
  ignore: !IS_WINDOWS,
  async fn() {
  const targetDir = await makeDirWithSpaces(
    "alteran-win-legacy-alias-",
    "copied target with spaces",
  );
  await copyActivateScripts(targetDir);

  const alteranSource = pathToFileURL(join(ALTERAN_REPO_DIR, "alteran.ts")).href;
  const output = await runCmd(
    [
      `call ${cmdQuote(join(targetDir, "activate.bat"))}`,
      `if not exist ${cmdQuote(join(targetDir, ".runtime", "alteran", "mod.ts"))} exit /b 1`,
      "alteran help >nul",
    ].join(" && "),
    {
      cwd: targetDir,
      env: {
        PATH: hostDenoPathWindows(),
        ALTERAN_SOURCES: alteranSource,
      },
    },
  );
  assertSuccess(output, "Expected legacy ALTERAN_SOURCES alias to bootstrap copied activate.bat");
  },
});

Deno.test({
  name: "windows cmd: empty Alteran source lists fail fast with explicit message",
  ignore: !IS_WINDOWS,
  async fn() {
  const targetDir = await makeDirWithSpaces(
    "alteran-win-empty-sources-",
    "empty source target",
  );
  await copyActivateScripts(targetDir);

  const output = await runCmd(
    `call ${cmdQuote(join(targetDir, "activate.bat"))}`,
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
    "Cannot download Alteran because ALTERAN_RUN_SOURCES and ALTERAN_ARCHIVE_SOURCES are empty",
    "Expected copied activate.bat to fail fast when both Alteran source lists are empty",
  );
  },
});

Deno.test({
  name: "windows powershell: direct & activate.bat initializes target from absolute path",
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
        `& ${psQuote(join(repoCopy, "activate.bat"))} ${psQuote(targetDir)}`,
        `if (!(Test-Path ${psQuote(join(targetDir, ".runtime", "alteran", "mod.ts"))})) { exit 1 }`,
        `if (!(Test-Path ${psQuote(join(targetDir, ".runtime", "env", "enter-env.bat"))})) { exit 1 }`,
      ].join("; "),
      {
        env: {
          PATH: hostDenoPathWindows(),
        },
      },
    );
    assertSuccess(output, "Expected PowerShell direct invocation to initialize the target");
  } finally {
    await removeIfExists(repoCopy);
  }
  },
});

Deno.test({
  name: "windows powershell: cmd /c call activate.bat can activate and run alteran",
  ignore: !IS_WINDOWS,
  async fn() {
  const repoCopy = await makeRepoCopyWithSpaces("alteran-win-repo-ps-cmd-");
  const targetDir = await makeDirWithSpaces(
    "alteran-win-target-ps-cmd-",
    "powershell cmd target with spaces",
  );

  try {
    const output = await runPowerShell(
      `cmd /d /c ${psQuote(`call ${cmdQuote(join(repoCopy, "activate.bat"))} ${
        cmdQuote(targetDir)
      } && alteran help >nul`)}`,
      {
        env: {
          PATH: hostDenoPathWindows(),
        },
      },
    );
    assertSuccess(output, "Expected PowerShell->cmd bridge activation to keep alteran usable");
  } finally {
    await removeIfExists(repoCopy);
  }
  },
});

Deno.test({
  name: "windows cmd: mirror-only DENO_SOURCES can bootstrap local deno without global install",
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
  await copyActivateScripts(targetDir);

  try {
    const output = await runCmd(
      [
        `call ${cmdQuote(join(targetDir, "activate.bat"))}`,
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
        `if not exist ${cmdQuote(join(targetDir, ".runtime", "alteran", "mod.ts"))} exit /b 1`,
      ].join(" && "),
      {
        cwd: targetDir,
        env: {
          PATH: windowsSystemPath(),
          DENO_SOURCES: mirror.baseUrl,
          ALTERAN_RUN_SOURCES: pathToFileURL(join(ALTERAN_REPO_DIR, "alteran.ts")).href,
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
  name: "windows cmd: PROCESSOR_ARCHITECTURE=ARM64 can use windows-arm64 local runtime path",
  ignore: !IS_WINDOWS,
  async fn() {
  const targetDir = await makeDirWithSpaces(
    "alteran-win-arm64-",
    "arm64 target with spaces",
  );
  await copyActivateScripts(targetDir);

  const arm64DenoDir = join(
    targetDir,
    ".runtime",
    "deno",
    "windows-arm64",
    "bin",
  );
  const arm64DenoPath = join(arm64DenoDir, "deno.exe");
  await ensureDir(arm64DenoDir);
  await Deno.copyFile(Deno.execPath(), arm64DenoPath);

  const repoInit = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", join(ALTERAN_REPO_DIR, "alteran.ts"), "ensure-env", targetDir],
    cwd: ALTERAN_REPO_DIR,
    env: Deno.env.toObject(),
    stdout: "piped",
    stderr: "piped",
  }).output();
  assertSuccess(repoInit, "Expected direct ensure-env bootstrap to seed runtime material");

  const output = await runCmd(
    [
      `call ${cmdQuote(join(targetDir, "activate.bat"))}`,
      `if not exist ${cmdQuote(join(targetDir, ".runtime", "env", "enter-env.bat"))} exit /b 1`,
    ].join(" && "),
    {
      cwd: targetDir,
      env: {
        PATH: windowsSystemPath(),
        PROCESSOR_ARCHITECTURE: "ARM64",
      },
    },
  );

  assertSuccess(
    output,
    "Expected activate.bat to use the windows-arm64 local runtime when PROCESSOR_ARCHITECTURE=ARM64",
  );
  },
});
