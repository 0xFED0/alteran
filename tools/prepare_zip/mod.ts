import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  copyDirectory,
  ensureDir,
  exists,
  removeIfExists,
} from "../../src/alteran/fs.ts";
import { ALTERAN_VERSION } from "../../src/alteran/version.ts";
import { getVersionedJsrDistDir } from "../prepare_jsr/mod.ts";

export function getVersionedZipDistDir(
  repoRoot: string,
  version = ALTERAN_VERSION,
): string {
  return join(repoRoot, "dist", "zips", version);
}

export function getReleaseZipPath(
  repoRoot: string,
  version = ALTERAN_VERSION,
): string {
  return join(
    getVersionedZipDistDir(repoRoot, version),
    `alteran-v${version}.zip`,
  );
}

export async function prepareReleaseZipStagingAt(
  repoRoot: string,
  stagingDir: string,
  version = ALTERAN_VERSION,
): Promise<void> {
  const jsrDir = getVersionedJsrDistDir(repoRoot, version);

  if (!(await exists(jsrDir))) {
    throw new Error(
      `Versioned JSR release directory does not exist: ${jsrDir}. Run prepare_jsr first.`,
    );
  }

  await removeIfExists(stagingDir);
  await copyDirectory(jsrDir, stagingDir);
  await copyDirectory(join(repoRoot, "docs"), join(stagingDir, "docs"));
}

async function createZipArchive(
  sourceDir: string,
  zipPath: string,
): Promise<void> {
  if (Deno.build.os === "windows") {
    const output = await new Deno.Command("powershell", {
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Compress-Archive -Path '${basename(sourceDir)}' -DestinationPath '${
          zipPath.replaceAll("'", "''")
        }' -Force`,
      ],
      cwd: resolve(sourceDir, ".."),
      stdout: "piped",
      stderr: "piped",
    }).output();

    if (!output.success) {
      throw new Error(
        new TextDecoder().decode(output.stderr).trim() ||
          `Compress-Archive failed with code ${output.code}`,
      );
    }
    return;
  }

  const output = await new Deno.Command("zip", {
    args: ["-qr", zipPath, basename(sourceDir)],
    cwd: resolve(sourceDir, ".."),
    stdout: "piped",
    stderr: "piped",
  }).output();

  if (!output.success) {
    throw new Error(
      new TextDecoder().decode(output.stderr).trim() ||
        `zip failed with code ${output.code}`,
    );
  }
}

export async function main(_args: string[]): Promise<void> {
  const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const zipDir = getVersionedZipDistDir(repoRoot);
  const zipPath = getReleaseZipPath(repoRoot);
  const tempRoot = await Deno.makeTempDir({ prefix: "alteran-release-zip-" });
  const stagingDir = join(tempRoot, ALTERAN_VERSION);

  await ensureDir(zipDir);
  await removeIfExists(zipPath);
  try {
    await prepareReleaseZipStagingAt(repoRoot, stagingDir);
    await createZipArchive(stagingDir, zipPath);
  } finally {
    await removeIfExists(tempRoot);
  }

  console.log(`Prepared ${zipPath}`);
}
