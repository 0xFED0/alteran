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
  readSetupBatTemplate,
  readSetupTemplate,
} from "../../src/alteran/templates/bootstrap.ts";
import { ALTERAN_VERSION } from "../../src/alteran/version.ts";

export const ALTERAN_JSR_PACKAGE_NAME = "@alteran/alteran";

export function getVersionedJsrDistDir(
  repoRoot: string,
  version = ALTERAN_VERSION,
): string {
  return join(repoRoot, "dist", "jsr", version);
}

export function renderJsrPackageConfig(version = ALTERAN_VERSION): string {
  return `${
    JSON.stringify(
      {
        name: ALTERAN_JSR_PACKAGE_NAME,
        version,
        license: "Apache-2.0",
        exports: {
          ".": "./alteran.ts",
          "./lib": "./src/alteran/mod.ts",
        },
      },
      null,
      2,
    )
  }\n`;
}

export function renderJsrPublishWorkspaceConfig(): string {
  return `${JSON.stringify({ workspace: ["."] }, null, 2)}\n`;
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

export async function prepareJsrPackageAt(
  repoRoot: string,
  distDir: string,
  version = ALTERAN_VERSION,
): Promise<void> {
  await removeIfExists(distDir);
  await ensureDir(distDir);

  await Deno.copyFile(
    join(repoRoot, "alteran.ts"),
    join(distDir, "alteran.ts"),
  );
  await writeTextFileIfChanged(
    join(distDir, "setup"),
    await readSetupTemplate(),
  );
  await writeTextFileIfChanged(
    join(distDir, "setup.bat"),
    await readSetupBatTemplate(),
  );
  if (Deno.build.os !== "windows") {
    await Deno.chmod(join(distDir, "setup"), 0o755);
  }
  await Deno.copyFile(join(repoRoot, "README.md"), join(distDir, "README.md"));
  await copyDirectory(join(repoRoot, "src"), join(distDir, "src"));

  await writeTextFileIfChanged(
    join(distDir, "jsr.json"),
    renderJsrPackageConfig(version),
  );
  await writeTextFileIfChanged(
    join(distDir, "deno.json"),
    renderJsrPublishWorkspaceConfig(),
  );
}

export async function main(_args: string[]): Promise<void> {
  const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const distRoot = join(repoRoot, "dist", "jsr");
  const distDir = getVersionedJsrDistDir(repoRoot);

  await ensureDir(distRoot);
  await removeLegacyTopLevelJsrEntries(distRoot);
  await prepareJsrPackageAt(repoRoot, distDir);

  console.log(`Prepared ${distDir}`);
}
