import { basename, join } from "node:path";

import { ensureDir, writeTextFileIfChanged } from "./fs.ts";

export async function createAppScaffold(
  projectDir: string,
  name: string,
): Promise<void> {
  const appDir = join(projectDir, "apps", name);
  await ensureDir(join(appDir, "core"));
  await ensureDir(join(appDir, "libs"));
  await ensureDir(join(appDir, "view"));

  await writeTextFileIfChanged(
    join(appDir, "app.json"),
    `${
      JSON.stringify(
        {
          name,
          id: name.toLowerCase(),
          version: "0.1.0",
          title: name,
          standalone: false,
          view: { enabled: false },
          entry: {
            core: "./core/mod.ts",
            view: "./view",
            app: "app",
          },
        },
        null,
        2,
      )
    }\n`,
  );

  await writeTextFileIfChanged(
    join(appDir, "deno.json"),
    `${
      JSON.stringify(
        {
          tasks: {
            core: "deno run -A ./core/mod.ts",
            view: "deno eval \"console.log('Alteran view placeholder')\"",
            app: "deno task core",
          },
        },
        null,
        2,
      )
    }\n`,
  );

  await writeTextFileIfChanged(
    join(appDir, "core", "mod.ts"),
    `export async function main(args: string[]): Promise<void> {
  console.log("App ${name} started", { args });
}

if (import.meta.main) {
  await main(Deno.args);
}
`,
  );

  await writeTextFileIfChanged(
    join(appDir, "view", "README.md"),
    `# ${name} view

This directory is intentionally reserved for future Alteran view integration.
`,
  );

  await writeTextFileIfChanged(join(appDir, "libs", ".keep"), "");

  await writeTextFileIfChanged(
    join(appDir, "app"),
    `#!/usr/bin/env sh
set -eu

APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_NAME="${name}"

if [ -n "\${ALTERAN_HOME:-}" ] && [ -f "$APP_DIR/../../.runtime/alteran/mod.ts" ]; then
  deno run -A "$APP_DIR/../../.runtime/alteran/mod.ts" app run "$APP_NAME" "$@"
else
  deno run -A "$APP_DIR/core/mod.ts" "$@"
fi
`,
  );
  if (Deno.build.os !== "windows") {
    await Deno.chmod(join(appDir, "app"), 0o755);
  }

  await writeTextFileIfChanged(
    join(appDir, "app.bat"),
    `@echo off
set "APP_DIR=%~dp0"
if defined ALTERAN_HOME (
  deno run -A "%APP_DIR%..\\..\\.runtime\\alteran\\mod.ts" app run ${name} %*
) else (
  deno run -A "%APP_DIR%core\\mod.ts" %*
)
`,
  );
}

export async function createStandaloneAppScaffold(path: string): Promise<void> {
  const name = basename(path);
  await ensureDir(join(path, "core"));
  await ensureDir(join(path, "libs"));
  await ensureDir(join(path, "view"));

  await writeTextFileIfChanged(
    join(path, "app.json"),
    `${
      JSON.stringify(
        {
          name,
          id: name.toLowerCase(),
          version: "0.1.0",
          title: name,
          standalone: true,
          view: { enabled: false },
          entry: {
            core: "./core/mod.ts",
            view: "./view",
            app: "app",
          },
        },
        null,
        2,
      )
    }\n`,
  );

  await writeTextFileIfChanged(
    join(path, "deno.json"),
    `${
      JSON.stringify(
        {
          tasks: {
            core: "deno run -A ./core/mod.ts",
            view: "deno eval \"console.log('Alteran view placeholder')\"",
            app: "deno task core",
          },
        },
        null,
        2,
      )
    }\n`,
  );

  await writeTextFileIfChanged(
    join(path, "core", "mod.ts"),
    `export async function main(args: string[]): Promise<void> {
  console.log("Standalone app ${name} started", { args });
}

if (import.meta.main) {
  await main(Deno.args);
}
`,
  );

  await writeTextFileIfChanged(join(path, "libs", ".keep"), "");
  await writeTextFileIfChanged(
    join(path, "app"),
    `#!/usr/bin/env sh
set -eu
APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
deno run -A "$APP_DIR/core/mod.ts" "$@"
`,
  );
  if (Deno.build.os !== "windows") {
    await Deno.chmod(join(path, "app"), 0o755);
  }
  await writeTextFileIfChanged(
    join(path, "app.bat"),
    `@echo off
deno run -A "%~dp0core\\mod.ts" %*
`,
  );
  await writeTextFileIfChanged(
    join(path, "view", "README.md"),
    `# ${name} view

Reserved for future Alteran view support.
`,
  );
}

export async function createToolScaffold(
  projectDir: string,
  name: string,
): Promise<void> {
  const entryPath = join(projectDir, "tools", `${name}.ts`);
  const helperDir = join(projectDir, "tools", name);
  await ensureDir(helperDir);

  await writeTextFileIfChanged(
    entryPath,
    `import { main } from "./${name}/mod.ts";

if (import.meta.main) {
  await main(Deno.args);
}
`,
  );

  await writeTextFileIfChanged(
    join(helperDir, "mod.ts"),
    `export async function main(args: string[]): Promise<void> {
  console.log("Tool ${name} started", { args });
}
`,
  );
}
