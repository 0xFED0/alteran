import { join } from "node:path";

import {
  createDefaultAlteranConfig,
  discoverTools,
  syncRootDenoConfig,
} from "../src/alteran/config.ts";
import { ensureDir } from "../src/alteran/fs.ts";
import {
  getConfiguredAlteranArchiveSources,
  getConfiguredAlteranRunSources,
  getConfiguredDenoSources,
  loadProjectDotEnv,
  resolveAlteranSourceRoot,
} from "../src/alteran/runtime.ts";
import { renderBatchEnv, renderShellEnv } from "../src/alteran/templates/env.ts";

function expect(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    Deno.env.delete(key);
    return;
  }
  Deno.env.set(key, value);
}

Deno.test("source configuration helpers honor defaults, explicit values, and empty lists", () => {
  const previousDenoSources = Deno.env.get("DENO_SOURCES");
  const previousRunSources = Deno.env.get("ALTERAN_RUN_SOURCES");
  const previousLegacySources = Deno.env.get("ALTERAN_SOURCES");
  const previousArchiveSources = Deno.env.get("ALTERAN_ARCHIVE_SOURCES");

  try {
    Deno.env.delete("DENO_SOURCES");
    Deno.env.delete("ALTERAN_RUN_SOURCES");
    Deno.env.delete("ALTERAN_SOURCES");
    Deno.env.delete("ALTERAN_ARCHIVE_SOURCES");

    expect(
      getConfiguredDenoSources().join("|") === "https://dl.deno.land/release",
      "Expected default Deno sources when DENO_SOURCES is unset",
    );

    Deno.env.set("DENO_SOURCES", "https://mirror-a.example/release; https://mirror-b.example/release");
    expect(
      getConfiguredDenoSources().join("|") ===
        "https://mirror-a.example/release|https://mirror-b.example/release",
      "Expected configured Deno source list to be parsed as-is",
    );

    Deno.env.set("ALTERAN_RUN_SOURCES", "");
    expect(
      getConfiguredAlteranRunSources().length === 0,
      "Expected an explicitly empty runnable-source list",
    );

    Deno.env.delete("ALTERAN_RUN_SOURCES");
    Deno.env.set(
      "ALTERAN_SOURCES",
      "jsr:@alteran https://example.com/alteran.ts",
    );
    expect(
      getConfiguredAlteranRunSources().join("|") ===
        "jsr:@alteran|https://example.com/alteran.ts",
      "Expected legacy ALTERAN_SOURCES alias to populate runnable sources",
    );

    Deno.env.set(
      "ALTERAN_ARCHIVE_SOURCES",
      "https://example.com/a.zip https://example.com/b.zip",
    );
    expect(
      getConfiguredAlteranArchiveSources().join("|") ===
        "https://example.com/a.zip|https://example.com/b.zip",
      "Expected configured archive sources to be parsed in order",
    );
  } finally {
    restoreEnv("DENO_SOURCES", previousDenoSources);
    restoreEnv("ALTERAN_RUN_SOURCES", previousRunSources);
    restoreEnv("ALTERAN_SOURCES", previousLegacySources);
    restoreEnv("ALTERAN_ARCHIVE_SOURCES", previousArchiveSources);
  }
});

Deno.test("project .env can point ALTERAN_SRC to a relative authored source root", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-dotenv-" });
  const sourceRoot = join(projectDir, "custom-src");
  const previousAlteranSrc = Deno.env.get("ALTERAN_SRC");
  const previousAlterunSrc = Deno.env.get("ALTERUN_SRC");

  try {
    Deno.env.delete("ALTERAN_SRC");
    Deno.env.delete("ALTERUN_SRC");

    await ensureDir(join(sourceRoot, "alteran"));
    await Deno.writeTextFile(join(sourceRoot, "alteran", "mod.ts"), "export {};\n");
    await Deno.writeTextFile(join(projectDir, ".env"), "ALTERAN_SRC=./custom-src\n");

    await loadProjectDotEnv(projectDir);
    const resolvedSourceRoot = await resolveAlteranSourceRoot(projectDir);

    expect(
      Deno.env.get("ALTERAN_SRC") === sourceRoot,
      "Expected ALTERAN_SRC to be resolved relative to the project .env",
    );
    expect(
      resolvedSourceRoot === sourceRoot,
      "Expected resolveAlteranSourceRoot to prefer the configured source root",
    );
  } finally {
    restoreEnv("ALTERAN_SRC", previousAlteranSrc);
    restoreEnv("ALTERUN_SRC", previousAlterunSrc);
  }
});

Deno.test("syncRootDenoConfig preserves user entries and generates managed tasks, imports, and workspace", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-root-config-" });
  await ensureDir(join(projectDir, "apps", "hello"));
  await ensureDir(join(projectDir, "libs"));
  await Deno.writeTextFile(join(projectDir, "libs", "shared.ts"), "export const value = 1;\n");
  await Deno.writeTextFile(
    join(projectDir, "deno.json"),
    JSON.stringify({
      tasks: {
        build: "deno task bundle",
      },
      imports: {
        "@/custom": "./custom.ts",
      },
      workspace: ["./old/workspace"],
    }, null, 2),
  );

  const config = createDefaultAlteranConfig(projectDir);
  config.apps.hello = {
    name: "hello",
    path: "./apps/hello",
    discovered: true,
  };
  config.tools.seed = {
    name: "seed",
    path: "./tools/seed.ts",
    discovered: true,
  };

  const nextConfig = await syncRootDenoConfig(projectDir, config);
  const persisted = JSON.parse(await Deno.readTextFile(join(projectDir, "deno.json")));

  expect(
    nextConfig.tasks?.build === "deno task bundle",
    "Expected user-defined tasks to be preserved",
  );
  expect(
    nextConfig.tasks?.alteran === "deno run -A ./alteran.ts",
    "Expected managed alteran task to be generated",
  );
  expect(
    nextConfig.tasks?.["app:hello"] === "deno run -A ./alteran.ts app run hello",
    "Expected managed app task to be generated",
  );
  expect(
    nextConfig.tasks?.["tool:seed"] === "deno run -A ./alteran.ts tool run seed",
    "Expected managed tool task to be generated",
  );
  expect(
    nextConfig.imports?.["@/custom"] === "./custom.ts",
    "Expected user-defined imports to be preserved",
  );
  expect(
    nextConfig.imports?.["@libs/shared"] === "./libs/shared.ts",
    "Expected project libs to be exposed through @libs/* aliases",
  );
  expect(
    JSON.stringify(nextConfig.workspace) === JSON.stringify(["./apps/hello"]),
    "Expected workspace to track registered apps",
  );
  expect(
    persisted.tasks.build === "deno task bundle" &&
      persisted.tasks["app:hello"] === "deno run -A ./alteran.ts app run hello",
    "Expected generated root deno.json to persist managed and user tasks",
  );
});

Deno.test("discoverTools supports both tool.ts and tool/mod.ts runtime-tool layouts", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-discover-tools-" });
  const config = createDefaultAlteranConfig(projectDir);

  await ensureDir(join(projectDir, "tools", "nested"));
  await Deno.writeTextFile(join(projectDir, "tools", "standalone.ts"), "export {};\n");
  await Deno.writeTextFile(join(projectDir, "tools", "nested", "mod.ts"), "export {};\n");

  const discovered = await discoverTools(projectDir, config);

  expect(
    discovered.standalone?.path === "./tools/standalone.ts",
    "Expected standalone tool.ts entry to be discovered",
  );
  expect(
    discovered.nested?.path === "./tools/nested/mod.ts",
    "Expected tool/mod.ts fallback entry to be discovered",
  );
});

Deno.test("env templates expose runtime variables and Alteran shortcuts", () => {
  const shell = renderShellEnv({
    runtimeDir: "/tmp/project/.runtime",
    cacheDir: "/tmp/project/.runtime/deno/linux-x64/cache",
    platformDir: "/tmp/project/.runtime/deno/linux-x64",
    denoBinDir: "/tmp/project/.runtime/deno/linux-x64/bin",
    alteranEntry: "/tmp/project/.runtime/alteran/mod.ts",
    appAliases: ["alias app-hello='alteran app run hello'"],
    toolAliases: ["alias tool-seed='alteran tool run seed'"],
  });
  const batch = renderBatchEnv({
    runtimeDir: "C:\\project\\.runtime",
    cacheDir: "C:\\project\\.runtime\\deno\\windows-x64\\cache",
    platformDir: "C:\\project\\.runtime\\deno\\windows-x64",
    denoBinDir: "C:\\project\\.runtime\\deno\\windows-x64\\bin",
    alteranEntry: "C:\\project\\.runtime\\alteran\\mod.ts",
    appAliases: ['doskey app-hello=deno run -A "C:\\project\\.runtime\\alteran\\mod.ts" app run hello $*'],
    toolAliases: ['doskey tool-seed=deno run -A "C:\\project\\.runtime\\alteran\\mod.ts" tool run seed $*'],
  });

  expect(
    shell.includes('export ALTERAN_HOME="/tmp/project/.runtime"'),
    "Expected shell env to export ALTERAN_HOME",
  );
  expect(
    shell.includes("alteran() { deno run -A \"/tmp/project/.runtime/alteran/mod.ts\" \"$@\"; }"),
    "Expected shell env to expose the alteran function",
  );
  expect(
    shell.includes("alias atest='alteran test'") &&
      shell.includes("alias app-hello='alteran app run hello'") &&
      shell.includes("alias tool-seed='alteran tool run seed'"),
    "Expected shell env to contain core and registry-derived aliases",
  );

  expect(
    batch.includes('set "ALTERAN_HOME=C:\\project\\.runtime"'),
    "Expected batch env to set ALTERAN_HOME",
  );
  expect(
    batch.includes('doskey alteran=deno run -A "C:\\project\\.runtime\\alteran\\mod.ts" $*'),
    "Expected batch env to expose the alteran doskey shim",
  );
  expect(
    batch.includes("doskey atest=alteran test $*") &&
      batch.includes('doskey app-hello=deno run -A "C:\\project\\.runtime\\alteran\\mod.ts" app run hello $*') &&
      batch.includes('doskey tool-seed=deno run -A "C:\\project\\.runtime\\alteran\\mod.ts" tool run seed $*'),
    "Expected batch env to contain core and registry-derived doskey shortcuts",
  );
});
