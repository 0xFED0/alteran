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

async function copySetupScripts(targetDir: string): Promise<void> {
  await Deno.copyFile(join(ALTERAN_REPO_DIR, "setup"), join(targetDir, "setup"));
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
  name: "windows cmd: generated activate.bat preserves session env and exposes deno/alteran",
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
        `call ${cmdQuote(join(repoCopy, "setup.bat"))} ${cmdQuote(targetDir)}`,
        `call ${cmdQuote(join(targetDir, "activate.bat"))}`,
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
        `call ${cmdQuote(join(repoCopy, "setup.bat"))} ${cmdQuote(targetDir)}`,
        `call ${cmdQuote(join(targetDir, "activate.bat"))}`,
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
  name: "windows cmd: copied setup.bat supports legacy ALTERAN_SOURCES alias and generates local activation",
  ignore: !IS_WINDOWS,
  async fn() {
  const targetDir = await makeDirWithSpaces(
    "alteran-win-legacy-alias-",
    "copied target with spaces",
  );
  await copySetupScripts(targetDir);

  const alteranSource = pathToFileURL(join(ALTERAN_REPO_DIR, "alteran.ts")).href;
  const output = await runCmd(
    [
      `call ${cmdQuote(join(targetDir, "setup.bat"))}`,
      `if not exist ${cmdQuote(join(targetDir, ".runtime", "alteran", "mod.ts"))} exit /b 1`,
      `if not exist ${cmdQuote(join(targetDir, "activate.bat"))} exit /b 1`,
      `call ${cmdQuote(join(targetDir, "activate.bat"))}`,
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
  assertSuccess(output, "Expected legacy ALTERAN_SOURCES alias to bootstrap copied setup.bat");
  },
});

Deno.test({
  name: "windows cmd: copied setup.bat fails fast when both Alteran source lists are empty",
  ignore: !IS_WINDOWS,
  async fn() {
  const targetDir = await makeDirWithSpaces(
    "alteran-win-empty-sources-",
    "empty source target",
  );
  await copySetupScripts(targetDir);

  const output = await runCmd(
    `call ${cmdQuote(join(targetDir, "setup.bat"))}`,
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
  name: "windows powershell: direct & setup.bat initializes target and generates activate.bat",
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
        `if (!(Test-Path ${psQuote(join(targetDir, ".runtime", "alteran", "mod.ts"))})) { exit 1 }`,
        `if (!(Test-Path ${psQuote(join(targetDir, "activate.bat"))})) { exit 1 }`,
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
  name: "windows powershell: cmd /c call generated activate.bat can activate and run alteran",
  ignore: !IS_WINDOWS,
  async fn() {
  const repoCopy = await makeRepoCopyWithSpaces("alteran-win-repo-ps-cmd-");
  const targetDir = await makeDirWithSpaces(
    "alteran-win-target-ps-cmd-",
    "powershell cmd target with spaces",
  );

  try {
    const output = await runPowerShell(
      `cmd /d /c ${psQuote(`call ${cmdQuote(join(repoCopy, "setup.bat"))} ${
        cmdQuote(targetDir)
      } && call ${cmdQuote(join(targetDir, "activate.bat"))} && alteran help >nul`)}`,
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
  await copySetupScripts(targetDir);

  try {
    const output = await runCmd(
      [
        `call ${cmdQuote(join(targetDir, "setup.bat"))}`,
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
        `if not exist ${cmdQuote(join(targetDir, "activate.bat"))} exit /b 1`,
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
  name: "windows cmd: generated activate.bat is tied to the concrete local runtime path produced by setup",
  ignore: !IS_WINDOWS,
  async fn() {
  const targetDir = await makeDirWithSpaces(
    "alteran-win-arm64-",
    "activation path target with spaces",
  );

  const repoSetup = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", join(ALTERAN_REPO_DIR, "alteran.ts"), "setup", targetDir],
    cwd: ALTERAN_REPO_DIR,
    env: Deno.env.toObject(),
    stdout: "piped",
    stderr: "piped",
  }).output();
  assertSuccess(repoSetup, "Expected direct setup bootstrap to seed runtime material");

  const activateBat = await Deno.readTextFile(join(targetDir, "activate.bat"));
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
    [
      `call ${cmdQuote(join(targetDir, "activate.bat"))}`,
      `if /I not "%ALTERAN_HOME%"==${cmdQuote(join(targetDir, ".runtime"))} exit /b 1`,
      "alteran help >nul",
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
    "Expected generated activate.bat to activate through its concrete local runtime path",
  );
  },
});
