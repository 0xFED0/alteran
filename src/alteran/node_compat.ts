import { spawn, spawnSync } from "node:child_process";
import { access, chmod, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface NodeCompatPlatform {
  id: string;
  denoTarget: string;
  denoBinaryName: string;
}

const DEFAULT_DENO_SOURCES = ["https://dl.deno.land/release"];

function parseConfiguredSources(value?: string): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(/[\s;]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getConfiguredDenoSources(): string[] {
  const configured = parseConfiguredSources(process.env.DENO_SOURCES);
  return configured.length > 0 ? configured : [...DEFAULT_DENO_SOURCES];
}

function detectNodeCompatPlatform(): NodeCompatPlatform {
  const os = process.platform === "darwin"
    ? "macos"
    : process.platform === "win32"
    ? "windows"
    : process.platform;
  const arch = process.arch === "x64"
    ? "x64"
    : process.arch === "arm64"
    ? "arm64"
    : process.arch;

  switch (`${os}-${arch}`) {
    case "macos-x64":
      return {
        id: "macos-x64",
        denoTarget: "x86_64-apple-darwin",
        denoBinaryName: "deno",
      };
    case "macos-arm64":
      return {
        id: "macos-arm64",
        denoTarget: "aarch64-apple-darwin",
        denoBinaryName: "deno",
      };
    case "linux-x64":
      return {
        id: "linux-x64",
        denoTarget: "x86_64-unknown-linux-gnu",
        denoBinaryName: "deno",
      };
    case "linux-arm64":
      return {
        id: "linux-arm64",
        denoTarget: "aarch64-unknown-linux-gnu",
        denoBinaryName: "deno",
      };
    case "windows-x64":
      return {
        id: "windows-x64",
        denoTarget: "x86_64-pc-windows-msvc",
        denoBinaryName: "deno.exe",
      };
    case "windows-arm64":
      return {
        id: "windows-arm64",
        denoTarget: "aarch64-pc-windows-msvc",
        denoBinaryName: "deno.exe",
      };
    default:
      throw new Error(
        `Unsupported platform for Node compatibility bridge: ${os}-${arch}`,
      );
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function getNodeCompatDenoPath(): string {
  const platform = detectNodeCompatPlatform();
  return join(
    tmpdir(),
    "alteran-node-compat",
    "deno",
    platform.id,
    "bin",
    platform.denoBinaryName,
  );
}

async function getRepositoryManagedDenoPath(): Promise<string | null> {
  const platform = detectNodeCompatPlatform();
  const managedPath = resolve(
    dirname(getRootEntryPath()),
    ".runtime",
    "deno",
    platform.id,
    "bin",
    platform.denoBinaryName,
  );
  return await exists(managedPath) ? managedPath : null;
}

function resolveLatestMetadataUrls(source: string): string[] {
  const normalized = source.replace(/\/+$/u, "");
  const urls = [`${normalized}/release-latest.txt`];
  if (normalized.endsWith("/release")) {
    urls.push(
      `${
        normalized.slice(0, -"release".length).replace(/\/+$/u, "")
      }/release-latest.txt`,
    );
  }
  return urls;
}

async function resolveLatestDenoVersion(): Promise<string> {
  const sources = getConfiguredDenoSources();
  const errors: string[] = [];

  for (const source of sources) {
    for (const metadataUrl of resolveLatestMetadataUrls(source)) {
      try {
        const response = await fetch(metadataUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return (await response.text()).trim();
      } catch (error) {
        errors.push(
          `${metadataUrl}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  throw new Error(
    `Failed to resolve a Deno release for the Node compatibility bridge. Check your internet connection or extend DENO_SOURCES. Attempts: ${
      errors.join(" | ")
    }`,
  );
}

async function extractZipArchive(
  archivePath: string,
  destinationDir: string,
): Promise<void> {
  const output = process.platform === "win32"
    ? await new Promise<{ success: boolean; errorText: string }>((resolve) => {
      const child = spawn("powershell", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Expand-Archive -Force -Path '${
          archivePath.replaceAll("'", "''")
        }' -DestinationPath '${destinationDir.replaceAll("'", "''")}'`,
      ], {
        stdio: ["ignore", "ignore", "pipe"],
      });

      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("exit", (code) => {
        resolve({ success: code === 0, errorText: stderr.trim() });
      });
    })
    : await new Promise<{ success: boolean; errorText: string }>((resolve) => {
      const child = spawn("unzip", ["-oq", archivePath, "-d", destinationDir], {
        stdio: ["ignore", "ignore", "pipe"],
      });

      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("exit", (code) => {
        resolve({ success: code === 0, errorText: stderr.trim() });
      });
    });

  if (!output.success) {
    throw new Error(output.errorText || "failed to extract Deno archive");
  }
}

async function downloadNodeCompatDeno(denoPath: string): Promise<string> {
  const sources = getConfiguredDenoSources();
  if (sources.length === 0) {
    throw new Error(
      "Cannot bootstrap Deno from Node because DENO_SOURCES is empty.",
    );
  }

  const platform = detectNodeCompatPlatform();
  const version = await resolveLatestDenoVersion();
  const archiveName = `deno-${platform.denoTarget}.zip`;
  const denoRootDir = dirname(dirname(denoPath));
  const unpackedBinaryPath = join(denoRootDir, platform.denoBinaryName);
  const archivePath = join(denoRootDir, archiveName);
  const errors: string[] = [];

  await mkdir(denoRootDir, { recursive: true });
  await mkdir(dirname(denoPath), { recursive: true });

  for (const source of sources) {
    const archiveUrl = `${
      source.replace(/\/+$/u, "")
    }/${version}/${archiveName}`;
    try {
      const response = await fetch(archiveUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await writeFile(
        archivePath,
        new Uint8Array(await response.arrayBuffer()),
      );
      await extractZipArchive(archivePath, denoRootDir);
      if (!(await exists(denoPath)) && await exists(unpackedBinaryPath)) {
        await rename(unpackedBinaryPath, denoPath);
      }
      await rm(archivePath, { force: true });

      if (process.platform !== "win32") {
        await chmod(denoPath, 0o755);
      }
      return denoPath;
    } catch (error) {
      errors.push(
        `${archiveUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await rm(archivePath, { force: true });
    }
  }

  throw new Error(
    `Failed to bootstrap Deno from Node using all configured sources. Check your internet connection or extend DENO_SOURCES. Attempts: ${
      errors.join(" | ")
    }`,
  );
}

async function resolveDenoExecutable(): Promise<string> {
  const explicitDeno = process.env.ALTERAN_NODE_DENO?.trim();
  if (explicitDeno) {
    return explicitDeno;
  }

  const repositoryManagedDeno = await getRepositoryManagedDenoPath();
  if (repositoryManagedDeno) {
    return repositoryManagedDeno;
  }

  const pathLookup = process.platform === "win32"
    ? spawnSync("where", ["deno"], { encoding: "utf8" })
    : spawnSync("which", ["deno"], { encoding: "utf8" });
  if (pathLookup.status === 0) {
    const denoPath = pathLookup.stdout.split(/\r?\n/u).map((line) =>
      line.trim()
    )
      .find(Boolean);
    if (denoPath) {
      return denoPath;
    }
  }

  const cachedDenoPath = getNodeCompatDenoPath();
  if (await exists(cachedDenoPath)) {
    return cachedDenoPath;
  }

  return await downloadNodeCompatDeno(cachedDenoPath);
}

function getRootEntryPath(): string {
  return fileURLToPath(new URL("../../alteran.ts", import.meta.url));
}

export async function runNodeCompatCli(args: string[]): Promise<number> {
  const denoExecutable = await resolveDenoExecutable();
  const rootEntry = getRootEntryPath();

  return await new Promise<number>((resolve, reject) => {
    const child = spawn(
      denoExecutable,
      ["run", "-A", rootEntry, ...args],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: "inherit",
      },
    );

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Deno process terminated by signal ${signal}`));
        return;
      }
      resolve(code ?? 0);
    });
  });
}
