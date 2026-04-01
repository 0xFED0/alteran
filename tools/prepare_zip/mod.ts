import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ensureDir, exists, removeIfExists } from "../../src/alteran/fs.ts";
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
  const jsrDir = getVersionedJsrDistDir(repoRoot);
  const zipDir = getVersionedZipDistDir(repoRoot);
  const zipPath = getReleaseZipPath(repoRoot);

  if (!(await exists(jsrDir))) {
    throw new Error(
      `Versioned JSR release directory does not exist: ${jsrDir}. Run prepare_jsr first.`,
    );
  }

  await ensureDir(zipDir);
  await removeIfExists(zipPath);
  await createZipArchive(jsrDir, zipPath);

  console.log(`Prepared ${zipPath}`);
}
