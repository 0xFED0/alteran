import { join } from "node:path";

import {
  createDefaultAlteranConfig,
  discoverApps,
  discoverTools,
  readAlteranConfig,
  syncAppDenoConfig,
  syncRootDenoConfig,
  updateAlteranConfig,
} from "../src/alteran/config.ts";
import { ensureDir } from "../src/alteran/fs.ts";
import { updateJsoncFile } from "../src/alteran/jsonc.ts";
import {
  buildAlteranLogtapeConfig,
  buildAlteranDefaultLogtapeConfig,
} from "../src/alteran/logging/logtape_config.ts";
import {
  finishLogSession,
  startLogSession,
} from "../src/alteran/logging/events.ts";
import {
  ensureLocalDeno,
  getConfiguredAlteranArchiveSources,
  getConfiguredAlteranRunSources,
  getConfiguredDenoSources,
  getProjectPaths,
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

  try {
    Deno.env.delete("ALTERAN_SRC");

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

Deno.test("syncRootDenoConfig includes reimported apps outside ./apps in workspace", async () => {
  const projectDir = await Deno.makeTempDir({
    prefix: "alteran-root-config-external-app-",
  });
  await ensureDir(join(projectDir, "incoming-apps", "admin-console"));

  const config = createDefaultAlteranConfig(projectDir);
  config.apps["admin-console"] = {
    name: "admin-console",
    path: "./incoming-apps/admin-console",
    discovered: true,
  };

  const nextConfig = await syncRootDenoConfig(projectDir, config);

  expect(
    JSON.stringify(nextConfig.workspace) ===
      JSON.stringify(["./incoming-apps/admin-console"]),
    "Expected workspace to include reimported apps outside ./apps",
  );
});

Deno.test("syncAppDenoConfig removes stale managed @libs aliases before rewriting imports", async () => {
  const projectDir = await Deno.makeTempDir({
    prefix: "alteran-app-config-alias-cleanup-",
  });
  const appDir = join(projectDir, "apps", "demo");
  await ensureDir(join(projectDir, "libs"));
  await ensureDir(appDir);
  await Deno.writeTextFile(
    join(appDir, "deno.json"),
    JSON.stringify({
      imports: {
        "@libs/helper": "./libs/helper.ts",
        "@/custom": "./custom.ts",
      },
    }, null, 2),
  );

  await syncAppDenoConfig(projectDir, "demo", appDir);
  const nextConfig = JSON.parse(await Deno.readTextFile(join(appDir, "deno.json")));

  expect(
    nextConfig.imports?.["@/custom"] === "./custom.ts",
    "Expected user imports to be preserved while rewriting managed app imports",
  );
  expect(
    nextConfig.imports?.["@libs/helper"] === undefined,
    "Expected stale managed @libs aliases to be removed from app-local deno.json",
  );
});

Deno.test("updateJsoncFile fails fast on invalid JSONC instead of silently mutating fallback state", async () => {
  const configPath = join(
    await Deno.makeTempDir({ prefix: "alteran-jsonc-invalid-" }),
    "alteran.json",
  );
  await Deno.writeTextFile(
    configPath,
    `{
  // broken
  "name": "demo",
`,
  );

  let threw = false;
  try {
    await updateJsoncFile(configPath, { name: "fallback" }, (current) => ({
      ...current,
      name: "updated",
    }));
  } catch (error) {
    threw = error instanceof Error &&
      error.message.includes("Invalid JSONC");
  }

  expect(
    threw,
    "Expected updateJsoncFile to fail explicitly when the input JSONC is invalid",
  );
});

Deno.test("startLogSession reuses the existing root invocation directory for child sessions", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-log-session-" });
  const config = createDefaultAlteranConfig(projectDir);
  const previousRunId = Deno.env.get("ALTERAN_RUN_ID");
  const previousRootRunId = Deno.env.get("ALTERAN_ROOT_RUN_ID");
  const previousRootLogDir = Deno.env.get("ALTERAN_ROOT_LOG_DIR");

  try {
    Deno.env.delete("ALTERAN_RUN_ID");
    Deno.env.delete("ALTERAN_ROOT_RUN_ID");
    Deno.env.delete("ALTERAN_ROOT_LOG_DIR");

    const rootSession = await startLogSession(
      projectDir,
      config,
      "tool",
      "seed",
      ["tool", "seed"],
    );
    Deno.env.set("ALTERAN_RUN_ID", rootSession.context.run_id);
    Deno.env.set("ALTERAN_ROOT_RUN_ID", rootSession.context.root_run_id);
    Deno.env.set("ALTERAN_ROOT_LOG_DIR", rootSession.rootDir);

    const childSession = await startLogSession(
      projectDir,
      config,
      "run",
      "child-script",
      ["run", "child-script.ts"],
    );

    expect(
      childSession.rootDir === rootSession.rootDir,
      "Expected child managed sessions to reuse the root invocation log directory",
    );
    expect(
      childSession.context.root_run_id === rootSession.context.root_run_id,
      "Expected child managed sessions to preserve the root run id",
    );
    expect(
      childSession.context.parent_run_id === rootSession.context.run_id,
      "Expected child managed sessions to point at the direct parent run id",
    );

    await finishLogSession(childSession, 0);
    await finishLogSession(rootSession, 0);
  } finally {
    restoreEnv("ALTERAN_RUN_ID", previousRunId);
    restoreEnv("ALTERAN_ROOT_RUN_ID", previousRootRunId);
    restoreEnv("ALTERAN_ROOT_LOG_DIR", previousRootLogDir);
  }
});

Deno.test("ensureLocalDeno can seed a new project runtime from the currently running Deno without downloading", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-local-deno-seed-" });
  const localDeno = await ensureLocalDeno(projectDir, Deno.version.deno);
  const paths = getProjectPaths(projectDir);

  expect(
    localDeno === paths.denoPath,
    "Expected ensureLocalDeno to materialize the managed runtime path",
  );
  expect(
    (await Deno.stat(localDeno)).isFile,
    "Expected ensureLocalDeno to seed a local managed Deno binary without downloading",
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

Deno.test("discoverApps respects auto_reimport include patterns for new app discovery", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-discover-apps-include-" });
  const config = createDefaultAlteranConfig(projectDir);
  config.auto_reimport.apps.include = ["./apps/allowed*"];

  await ensureDir(join(projectDir, "apps", "allowed-demo"));
  await ensureDir(join(projectDir, "apps", "manual"));

  const discovered = await discoverApps(projectDir, config);

  expect(
    discovered["allowed-demo"]?.path === "./apps/allowed-demo",
    "Expected include patterns to allow matching app discovery",
  );
  expect(
    discovered.manual === undefined,
    "Expected include patterns to block non-matching app discovery",
  );
});

Deno.test("discoverTools respects auto_reimport include patterns for new tool discovery", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-discover-tools-include-" });
  const config = createDefaultAlteranConfig(projectDir);
  config.auto_reimport.tools.include = ["./tools/allowed*"];

  await ensureDir(join(projectDir, "tools", "allowed-nested"));
  await Deno.writeTextFile(join(projectDir, "tools", "manual.ts"), "export {};\n");
  await Deno.writeTextFile(join(projectDir, "tools", "allowed.ts"), "export {};\n");
  await Deno.writeTextFile(join(projectDir, "tools", "allowed-nested", "mod.ts"), "export {};\n");

  const discovered = await discoverTools(projectDir, config);

  expect(
    discovered.allowed?.path === "./tools/allowed.ts",
    "Expected include patterns to allow matching standalone tools",
  );
  expect(
    discovered["allowed-nested"]?.path === "./tools/allowed-nested/mod.ts",
    "Expected include patterns to allow matching nested tool discovery",
  );
  expect(
    discovered.manual === undefined,
    "Expected include patterns to block non-matching tool discovery",
  );
});

Deno.test("buildAlteranDefaultLogtapeConfig creates the builtin events sink and root logger", () => {
  const config = buildAlteranDefaultLogtapeConfig() as {
    sinks?: Record<string, unknown>;
    loggers?: Array<Record<string, unknown>>;
  };

  expect(
    typeof config.sinks?.alteran_events === "function",
    "Expected builtin LogTape config to provide the alteran_events sink",
  );
  expect(
    Array.isArray(config.loggers) && config.loggers.length === 1,
    "Expected builtin LogTape config to provide one default root logger",
  );
  expect(
    JSON.stringify(config.loggers?.[0]?.category) === JSON.stringify([]),
    "Expected builtin LogTape root logger to target the global category tree",
  );
});

Deno.test("buildAlteranLogtapeConfig deep-merges user config over defaults", () => {
  const config = buildAlteranLogtapeConfig({
    loggers: [
      {
        category: ["example"],
        lowestLevel: "fatal",
        sinks: ["alteran_events"],
      },
    ],
    sinks: {
      custom: "custom-sink-marker",
    },
  }) as {
    sinks?: Record<string, unknown>;
    loggers?: Array<Record<string, unknown>>;
  };

  expect(
    typeof config.sinks?.alteran_events === "function",
    "Expected merged LogTape config to preserve the builtin events sink",
  );
  expect(
    config.sinks?.custom === "custom-sink-marker",
    "Expected merged LogTape config to include user sink configuration",
  );
  expect(
    Array.isArray(config.loggers) && config.loggers.length === 2,
    "Expected merged LogTape config to append user loggers over defaults",
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
    shellAliases: ["alias myrun='alt run scripts/demo.ts'"],
  });
  const batch = renderBatchEnv({
    runtimeDir: "C:\\project\\.runtime",
    cacheDir: "C:\\project\\.runtime\\deno\\windows-x64\\cache",
    platformDir: "C:\\project\\.runtime\\deno\\windows-x64",
    denoBinDir: "C:\\project\\.runtime\\deno\\windows-x64\\bin",
    alteranEntry: "C:\\project\\.runtime\\alteran\\mod.ts",
    appAliases: ['doskey app-hello=deno run -A "C:\\project\\.runtime\\alteran\\mod.ts" app run hello $*'],
    toolAliases: ['doskey tool-seed=deno run -A "C:\\project\\.runtime\\alteran\\mod.ts" tool run seed $*'],
    shellAliases: ['doskey myrun=alt run scripts/demo.ts $*'],
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
      shell.includes("alias tool-seed='alteran tool run seed'") &&
      shell.includes("alias myrun='alt run scripts/demo.ts'"),
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
      batch.includes('doskey tool-seed=deno run -A "C:\\project\\.runtime\\alteran\\mod.ts" tool run seed $*') &&
      batch.includes("doskey myrun=alt run scripts/demo.ts $*"),
    "Expected batch env to contain core and registry-derived doskey shortcuts",
  );
});

Deno.test("readAlteranConfig provides a default empty shell_aliases map", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-shell-alias-defaults-" });
  const config = await readAlteranConfig(projectDir);

  expect(
    JSON.stringify(config.shell_aliases) === "{}",
    "Expected default shell_aliases to exist and be empty",
  );
});

Deno.test("updateAlteranConfig can persist shell_aliases and entry alias fields", async () => {
  const projectDir = await Deno.makeTempDir({ prefix: "alteran-alias-config-" });

  await updateAlteranConfig(projectDir, (current) => ({
    ...current,
    shell_aliases: {
      myrun: "alt run scripts/demo.ts",
    },
    apps: {
      hello: {
        path: "./apps/hello",
        shell_aliases: ["app-hello", "hello-now"],
      },
    },
    tools: {
      seed: {
        path: "./tools/seed.ts",
        shell_aliases: ["seed-now"],
      },
    },
  }));

  const config = await readAlteranConfig(projectDir);
  expect(
    JSON.stringify(config.apps.hello.shell_aliases) ===
      JSON.stringify(["app-hello", "hello-now"]),
    "Expected app entry alias fields to persist",
  );
  expect(
    JSON.stringify(config.tools.seed.shell_aliases) ===
      JSON.stringify(["seed-now"]),
    "Expected tool entry alias fields to persist",
  );
  expect(
    config.shell_aliases.myrun === "alt run scripts/demo.ts",
    "Expected shell_aliases to persist",
  );
});
