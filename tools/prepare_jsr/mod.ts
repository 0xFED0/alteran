import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  copyDirectory,
  ensureDir,
  exists,
  removeIfExists,
  writeTextFileIfChanged,
} from "../../src/alteran/fs.ts";
import {
  readActivateBatTemplate,
  readActivateTemplate,
} from "../../src/alteran/templates/bootstrap.ts";
import { ALTERAN_VERSION } from "../../src/alteran/version.ts";

export function getVersionedJsrDistDir(
  repoRoot: string,
  version = ALTERAN_VERSION,
): string {
  return join(repoRoot, "dist", "jsr", version);
}

function isVersionDirectoryName(name: string): boolean {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(name);
}

async function removeLegacyTopLevelJsrEntries(distRoot: string): Promise<void> {
  if (!(await exists(distRoot))) {
    return;
  }

  for await (const entry of Deno.readDir(distRoot)) {
    if (entry.isDirectory && isVersionDirectoryName(entry.name)) {
      continue;
    }
    await removeIfExists(join(distRoot, entry.name));
  }
}

export async function main(_args: string[]): Promise<void> {
  const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const distRoot = join(repoRoot, "dist", "jsr");
  const distDir = getVersionedJsrDistDir(repoRoot);

  await ensureDir(distRoot);
  await removeLegacyTopLevelJsrEntries(distRoot);
  await removeIfExists(distDir);
  await ensureDir(distDir);

  await Deno.copyFile(
    join(repoRoot, "alteran.ts"),
    join(distDir, "alteran.ts"),
  );
  await writeTextFileIfChanged(
    join(distDir, "activate"),
    await readActivateTemplate(),
  );
  await writeTextFileIfChanged(
    join(distDir, "activate.bat"),
    await readActivateBatTemplate(),
  );
  if (Deno.build.os !== "windows") {
    await Deno.chmod(join(distDir, "activate"), 0o755);
  }
  await Deno.copyFile(join(repoRoot, "README.md"), join(distDir, "README.md"));
  await copyDirectory(join(repoRoot, "src"), join(distDir, "src"));

  await writeTextFileIfChanged(
    join(distDir, "jsr.json"),
    `${
      JSON.stringify(
        {
          name: "@alteran",
          version: ALTERAN_VERSION,
          exports: {
            ".": "./alteran.ts",
            "./lib": "./src/alteran/mod.ts",
          },
        },
        null,
        2,
      )
    }\n`,
  );

  console.log(`Prepared ${distDir}`);
}
