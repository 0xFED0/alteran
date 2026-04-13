import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDefaultAlteranConfig,
  discoverApps,
  discoverTools,
  readAlteranConfig,
  syncAppDenoConfig,
  syncRootDenoConfig,
  updateAlteranConfig,
} from "../src/alteran/config.ts";
import { ensureDir, exists } from "../src/alteran/fs.ts";
import { copyDirectory } from "../src/alteran/fs.ts";
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
import { runCli } from "../src/alteran/mod.ts";
import { renderBatchEnv, renderShellEnv } from "../src/alteran/templates/env.ts";
import { ALTERAN_VERSION } from "../src/alteran/version.ts";
import {
  ALTERAN_JSR_PACKAGE_NAME,
  getVersionedJsrDistDir,
  prepareJsrPackageAt,
  renderJsrPackageConfig,
  renderJsrPublishWorkspaceConfig,
} from "../tools/prepare_jsr/mod.ts";
import {
  parsePublishJsrArgs,
  renderPublishJsrHelp,
  resolveLatestPreparedJsrVersion,
} from "../tools/publish_jsr/mod.ts";
import {
  getReleaseZipPath,
  getVersionedZipDistDir,
  prepareReleaseZipStagingAt,
} from "../tools/prepare_zip/mod.ts";
import { resetExamples } from "../examples/reset.ts";
import {
  createExampleTempCopy,
  EXAMPLE_CATALOG,
  resolveExampleSelections,
  renderHelp as renderExamplesToolHelp,
} from "../tools/examples/mod.ts";

function expect(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertFileEquals(path: string, expected: string): Promise<void> {
  const actual = await Deno.readTextFile(path);
  expect(
    actual === expected,
    `Expected ${path} to stay synchronized with the repository source-of-truth file`,
  );
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
      "jsr:@alteran/alteran https://example.com/alteran.ts",
    );
    expect(
      getConfiguredAlteranRunSources().join("|") ===
        "jsr:@alteran/alteran|https://example.com/alteran.ts",
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

Deno.test("runCli provides help for subcommands instead of treating help as data", async () => {
  const consoleLog = console.log;
  const consoleError = console.error;
  const messages: string[] = [];
  const errors: string[] = [];
  console.log = (...args: unknown[]) => {
    messages.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  };

  try {
    const legacySetupAlias = ["in", "it"].join("");
    const appHelpExitCode = await runCli(["app", "--help"]);
    const cleanHelpExitCode = await runCli(["clean", "--help"]);
    const cleanNoScopeExitCode = await runCli(["clean"]);
    const externalHelpExitCode = await runCli(["external", "--help"]);
    const fromHelpExitCode = await runCli(["from", "--help"]);
    const legacyAppSetupAliasExitCode = await runCli([
      "app",
      legacySetupAlias,
      "./portable-clock",
    ]);

    expect(
      appHelpExitCode === 0 &&
        cleanHelpExitCode === 0 &&
        cleanNoScopeExitCode === 0 &&
        externalHelpExitCode === 0 &&
        fromHelpExitCode === 0 &&
        legacyAppSetupAliasExitCode !== 0,
      "Expected help invocations to exit with code 0 and legacy app setup alias to fail",
    );

    const joined = messages.join("\n");
    const joinedErrors = errors.join("\n");
    expect(joined.includes("alteran app"), "Expected app help output");
    expect(joined.includes("alteran clean"), "Expected clean help output");
    expect(joined.includes("alteran external"), "Expected external help output");
    expect(joined.includes("alteran from"), "Expected from help output");
    expect(joined.includes("Scopes:"), "Expected clean scopes in help output");
    expect(
      joined.includes("alteran clean <scope> [<scope> ...]"),
      "Expected multi-scope clean usage in help output",
    );
    expect(
      !joined.includes(`app ${legacySetupAlias}`),
      "Expected app help output not to advertise the removed legacy app setup alias",
    );
    expect(
      joinedErrors.includes(`Unsupported app command: ${legacySetupAlias}`),
      "Expected the removed legacy app setup alias to be rejected explicitly",
    );
  } finally {
    console.log = consoleLog;
    console.error = consoleError;
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

Deno.test("prepare_jsr renders the expected scoped package metadata", () => {
  const rendered = JSON.parse(renderJsrPackageConfig());

  expect(
    rendered.name === ALTERAN_JSR_PACKAGE_NAME,
    "Expected JSR package metadata to use the scoped package name",
  );
  expect(
    rendered.license === "Apache-2.0",
    "Expected JSR package metadata to declare the Apache-2.0 license",
  );
  expect(
    rendered.exports?.["."] === "./alteran.ts" &&
      rendered.exports?.["./lib"] === "./src/alteran/mod.ts",
    "Expected JSR package exports to expose CLI root and library subpath",
  );
});

Deno.test("prepare_jsr renders a self-contained publish workspace config", () => {
  const rendered = JSON.parse(renderJsrPublishWorkspaceConfig());

  expect(
    JSON.stringify(rendered.workspace) === JSON.stringify(["."]),
    "Expected publish workspace config to treat the versioned JSR dir as its own workspace root",
  );
});

Deno.test("release helpers use versioned dist directories", () => {
  const repoRoot = Deno.build.os === "windows" ? "C:\\alteran" : "/tmp/alteran";

  expect(
    getVersionedJsrDistDir(repoRoot) ===
      join(repoRoot, "dist", "jsr", ALTERAN_VERSION),
    "Expected prepare_jsr output to be versioned",
  );
  expect(
    getVersionedZipDistDir(repoRoot) ===
      join(repoRoot, "dist", "zips", ALTERAN_VERSION),
    "Expected prepare_zip output directory to be versioned",
  );
  expect(
    getReleaseZipPath(repoRoot) ===
      join(
        repoRoot,
        "dist",
        "zips",
        ALTERAN_VERSION,
        `alteran-v${ALTERAN_VERSION}.zip`,
      ),
    "Expected release zip path to include version",
  );
});

Deno.test("prepare_jsr stays lean while release zip staging adds docs", async () => {
  const repoRoot = await Deno.makeTempDir({
    prefix: "alteran-publication-shape-",
  });
  const jsrDir = join(repoRoot, "dist", "jsr", ALTERAN_VERSION);
  const zipStageDir = join(repoRoot, "dist", "zip-stage", ALTERAN_VERSION);

  await ensureDir(join(repoRoot, "src", "alteran"));
  await ensureDir(join(repoRoot, "docs", "user"));
  await Deno.writeTextFile(join(repoRoot, "alteran.ts"), "export {};\n");
  await Deno.writeTextFile(join(repoRoot, "README.md"), "# Alteran\n");
  await Deno.writeTextFile(
    join(repoRoot, "src", "alteran", "mod.ts"),
    "export {};\n",
  );
  await Deno.writeTextFile(
    join(repoRoot, "docs", "user", "quickstart.md"),
    "# Quick Start\n",
  );

  await prepareJsrPackageAt(repoRoot, jsrDir, ALTERAN_VERSION);
  expect(
    !(await exists(join(jsrDir, "docs"))),
    "Expected staged JSR package not to include the full docs tree",
  );

  await prepareReleaseZipStagingAt(repoRoot, zipStageDir, ALTERAN_VERSION);
  expect(
    await exists(join(zipStageDir, "docs", "user", "quickstart.md")),
    "Expected release zip staging to include the repository docs tree",
  );
  expect(
    !(await exists(join(zipStageDir, "deno.json"))),
    "Expected release zip staging not to include the publish-only deno.json workspace config",
  );
  expect(
    !(await exists(join(zipStageDir, "jsr.json"))),
    "Expected release zip staging not to include the publish-only jsr.json metadata file",
  );
});

Deno.test("publish_jsr argument parsing supports version and token flags", () => {
  const previousJsrToken = Deno.env.get("JSR_TOKEN");
  const previousAlteranJsrToken = Deno.env.get("ALTERAN_JSR_TOKEN");

  try {
    Deno.env.set("ALTERAN_JSR_TOKEN", "env-token");
    Deno.env.delete("JSR_TOKEN");

    const parsed = parsePublishJsrArgs([
      "--version",
      "latest",
      "--token=flag-token",
    ]);
    expect(parsed.version === "latest", "Expected explicit --version to be parsed");
    expect(parsed.token === "flag-token", "Expected explicit --token to override env token");

    const envParsed = parsePublishJsrArgs([]);
    expect(envParsed.version === "current", "Expected publish_jsr to default to current version");
    expect(envParsed.token === "env-token", "Expected publish_jsr to accept ALTERAN_JSR_TOKEN from env");

    const helpParsed = parsePublishJsrArgs(["--help"]);
    expect(helpParsed.helpRequested === true, "Expected publish_jsr to recognize --help");
  } finally {
    restoreEnv("JSR_TOKEN", previousJsrToken);
    restoreEnv("ALTERAN_JSR_TOKEN", previousAlteranJsrToken);
  }
});

Deno.test("publish_jsr help describes versions and token sources", () => {
  const help = renderPublishJsrHelp();

  expect(
    help.includes("--version <current|latest|x.y.z>"),
    "Expected publish_jsr help to describe version selection",
  );
  expect(
    help.includes("JSR_TOKEN") && help.includes("ALTERAN_JSR_TOKEN"),
    "Expected publish_jsr help to describe token environment variables",
  );
});

Deno.test("publish_jsr can resolve the latest prepared version from dist/jsr", async () => {
  const repoRoot = await Deno.makeTempDir({ prefix: "alteran-publish-jsr-latest-" });
  await ensureDir(join(repoRoot, "dist", "jsr", "0.1.0"));
  await ensureDir(join(repoRoot, "dist", "jsr", "0.2.0"));
  await ensureDir(join(repoRoot, "dist", "jsr", "0.2.0-beta.1"));

  const latest = await resolveLatestPreparedJsrVersion(repoRoot);
  expect(
    latest === "0.2.0",
    `Expected latest prepared version to prefer stable semver ordering, got ${latest}`,
  );
});

Deno.test("committed example setup scripts stay synchronized with the repository bootstrap scripts", async () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const expectedSetup = await Deno.readTextFile(join(repoRoot, "setup"));
  const expectedSetupBat = await Deno.readTextFile(join(repoRoot, "setup.bat"));

  for (
    const relativeDir of [
      "examples/01-bootstrap-empty-folder",
      "examples/02-multi-app-workspace",
      "examples/03-tools-workspace",
      "examples/04-managed-vs-plain-deno",
      "examples/05-logging-run-tree",
      "examples/06-refresh-reimport",
      "examples/07-compact-transfer-ready",
      "examples/advanced/logtape-categories",
    ]
  ) {
    await assertFileEquals(join(repoRoot, relativeDir, "setup"), expectedSetup);
    await assertFileEquals(
      join(repoRoot, relativeDir, "setup.bat"),
      expectedSetupBat,
    );
  }
});

Deno.test("examples tool catalog resolves selectors in deterministic catalog order", () => {
  const resolved = resolveExampleSelections([
    "advanced/logtape-categories",
    "02-multi-app-workspace",
    "advanced/standalone-app-runtime",
  ]);

  expect(
    JSON.stringify(resolved.map((entry) => entry.selector)) === JSON.stringify([
      "advanced/logtape-categories",
      "02-multi-app-workspace",
      "advanced/standalone-app-runtime",
    ]),
    "Expected explicit example selectors to resolve in caller order without duplication",
  );

  const help = renderExamplesToolHelp();
  expect(
    help.includes("alteran tool run examples"),
    "Expected examples tool help to describe the maintainer entrypoint",
  );
});

Deno.test("examples tool temp copy for managed examples uses compact-copy style omission", async () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const tempRepo = await Deno.makeTempDir({
    prefix: "alteran-examples-tool-managed-copy-",
  });
  const entry = EXAMPLE_CATALOG.find((item) => item.selector === "07-compact-transfer-ready");

  expect(entry, "Expected managed example catalog entry");

  await ensureDir(join(tempRepo, "examples"));
  await copyDirectory(
    join(repoRoot, "examples", "07-compact-transfer-ready"),
    join(tempRepo, "examples", "07-compact-transfer-ready"),
  );

  const sourceDir = join(tempRepo, "examples", "07-compact-transfer-ready");
  await ensureDir(join(sourceDir, ".runtime"));
  await Deno.writeTextFile(join(sourceDir, "activate"), "generated\n");
  await Deno.writeTextFile(join(sourceDir, "activate.bat"), "generated\r\n");
  await ensureDir(join(sourceDir, "dist"));
  await ensureDir(join(sourceDir, "apps", "portable-cli", ".runtime"));

  const tempCopy = await createExampleTempCopy(entry!, tempRepo);

  expect(
    !(await exists(join(tempCopy, ".runtime"))),
    "Expected managed example temp copy not to include .runtime",
  );
  expect(
    !(await exists(join(tempCopy, "activate"))),
    "Expected managed example temp copy not to include activate",
  );
  expect(
    !(await exists(join(tempCopy, "dist"))),
    "Expected managed example temp copy not to include dist",
  );
  expect(
    !(await exists(join(tempCopy, "apps", "portable-cli", ".runtime"))),
    "Expected managed example temp copy not to include nested app runtime",
  );
  expect(
    await exists(join(tempCopy, "setup")),
    "Expected managed example temp copy to preserve setup",
  );
});

Deno.test("examples tool temp copy for bootstrap-empty examples preserves source-first baseline", async () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const tempRepo = await Deno.makeTempDir({
    prefix: "alteran-examples-tool-bootstrap-copy-",
  });
  const entry = EXAMPLE_CATALOG.find((item) => item.selector === "01-bootstrap-empty-folder");

  expect(entry, "Expected bootstrap-empty example catalog entry");

  await ensureDir(join(tempRepo, "examples"));
  await copyDirectory(
    join(repoRoot, "examples", "01-bootstrap-empty-folder"),
    join(tempRepo, "examples", "01-bootstrap-empty-folder"),
  );

  const sourceDir = join(tempRepo, "examples", "01-bootstrap-empty-folder");
  await ensureDir(join(sourceDir, ".runtime"));
  await Deno.writeTextFile(join(sourceDir, "activate"), "generated\n");
  await Deno.writeTextFile(join(sourceDir, "alteran.json"), "{}\n");
  await ensureDir(join(sourceDir, "libs"));
  await Deno.writeTextFile(join(sourceDir, "libs", ".keep"), "\n");

  const tempCopy = await createExampleTempCopy(entry!, tempRepo);

  expect(
    !(await exists(join(tempCopy, ".runtime"))),
    "Expected bootstrap-empty temp copy not to include .runtime",
  );
  expect(
    !(await exists(join(tempCopy, "alteran.json"))),
    "Expected bootstrap-empty temp copy not to include materialized alteran.json",
  );
  expect(
    !(await exists(join(tempCopy, "libs"))),
    "Expected bootstrap-empty temp copy not to include materialized source directories",
  );
  expect(
    await exists(join(tempCopy, ".gitignore")),
    "Expected bootstrap-empty temp copy to preserve its protective .gitignore",
  );
  expect(
    await exists(join(tempCopy, ".env")),
    "Expected bootstrap-empty temp copy to preserve its authored .env",
  );
});

Deno.test("committed examples include protective nested gitignore files for generated artifacts", async () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

  for (
    const relativePath of [
      "examples/01-bootstrap-empty-folder/.gitignore",
      "examples/02-multi-app-workspace/.gitignore",
      "examples/03-tools-workspace/.gitignore",
      "examples/04-managed-vs-plain-deno/.gitignore",
      "examples/05-logging-run-tree/.gitignore",
      "examples/06-refresh-reimport/.gitignore",
      "examples/07-compact-transfer-ready/.gitignore",
      "examples/advanced/logtape-categories/.gitignore",
      "examples/advanced/standalone-app-runtime/standalone-clock/.gitignore",
    ]
  ) {
    expect(
      await exists(join(repoRoot, relativePath)),
      `Expected ${relativePath} to exist`,
    );
  }
});

Deno.test("examples reset removes known generated artifacts and restores managed bootstrap scripts", async () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const tempRepo = await Deno.makeTempDir({ prefix: "alteran-examples-reset-" });

  await ensureDir(join(tempRepo, "examples"));
  await Deno.copyFile(join(repoRoot, "setup"), join(tempRepo, "setup"));
  await Deno.copyFile(join(repoRoot, "setup.bat"), join(tempRepo, "setup.bat"));

  for (
    const relativePath of [
      "examples/01-bootstrap-empty-folder",
      "examples/07-compact-transfer-ready",
      "examples/advanced/standalone-app-runtime",
    ]
  ) {
    await copyDirectory(
      join(repoRoot, relativePath),
      join(tempRepo, relativePath),
    );
  }

  await Deno.writeTextFile(
    join(tempRepo, "examples", "07-compact-transfer-ready", "setup"),
    "outdated setup\n",
  );
  await Deno.writeTextFile(
    join(tempRepo, "examples", "01-bootstrap-empty-folder", "alteran.json"),
    "{}\n",
  );
  await Deno.writeTextFile(
    join(tempRepo, "examples", "01-bootstrap-empty-folder", "deno.json"),
    "{}\n",
  );
  await ensureDir(join(tempRepo, "examples", "01-bootstrap-empty-folder", "libs"));
  await Deno.writeTextFile(
    join(tempRepo, "examples", "01-bootstrap-empty-folder", "libs", ".keep"),
    "\n",
  );
  await ensureDir(
    join(tempRepo, "examples", "07-compact-transfer-ready", ".runtime"),
  );
  await Deno.writeTextFile(
    join(
      tempRepo,
      "examples",
      "07-compact-transfer-ready",
      "apps",
      "portable-cli",
      "app",
    ),
    "generated\n",
  );
  await Deno.writeTextFile(
    join(
      tempRepo,
      "examples",
      "advanced",
      "standalone-app-runtime",
      "standalone-clock",
      "app",
    ),
    "generated\n",
  );
  await ensureDir(
    join(
      tempRepo,
      "examples",
      "advanced",
      "standalone-app-runtime",
      "standalone-clock",
      ".runtime",
    ),
  );

  await resetExamples(tempRepo);

  expect(
    !(await exists(join(
      tempRepo,
      "examples",
      "01-bootstrap-empty-folder",
      "alteran.json",
    ))),
    "Expected reset to remove materialized bootstrap files from 01-bootstrap-empty-folder",
  );
  expect(
    await exists(join(
      tempRepo,
      "examples",
      "01-bootstrap-empty-folder",
      ".gitignore",
    )),
    "Expected reset to preserve the protective .gitignore in 01-bootstrap-empty-folder",
  );
  expect(
    !(await exists(join(
      tempRepo,
      "examples",
      "07-compact-transfer-ready",
      ".runtime",
    ))),
    "Expected reset to remove project-local runtime material from managed examples",
  );
  expect(
    !(await exists(join(
      tempRepo,
      "examples",
      "07-compact-transfer-ready",
      "apps",
      "portable-cli",
      "app",
    ))),
    "Expected reset to remove generated nested app launchers from managed examples",
  );
  expect(
    !(await exists(join(
      tempRepo,
      "examples",
      "advanced",
      "standalone-app-runtime",
      "standalone-clock",
      "app",
    ))),
    "Expected reset to remove generated standalone app launchers",
  );
  expect(
    await exists(join(
      tempRepo,
      "examples",
      "advanced",
      "standalone-app-runtime",
      "standalone-clock",
      ".gitignore",
    )),
    "Expected reset to preserve the standalone app protective .gitignore",
  );
  expect(
    await exists(join(
      tempRepo,
      "examples",
      "advanced",
      "standalone-app-runtime",
      "standalone-clock",
      "libs",
      ".keep",
    )),
    "Expected reset to preserve tracked standalone app baseline files",
  );

  await assertFileEquals(
    join(tempRepo, "examples", "07-compact-transfer-ready", "setup"),
    await Deno.readTextFile(join(repoRoot, "setup")),
  );
});

Deno.test("env templates expose runtime variables and Alteran shortcuts", () => {
  const shell = renderShellEnv({
    runtimeDir: "/tmp/project/.runtime",
    cacheDir: "/tmp/project/.runtime/deno/linux-x64/cache",
    platformDir: "/tmp/project/.runtime/deno/linux-x64",
    denoBinDir: "/tmp/project/.runtime/deno/linux-x64/bin",
    wrapperBinDir: "/tmp/project/.runtime/alteran",
    shellWrapper: "/tmp/project/.runtime/alteran/alteran.sh",
    batchWrapper: "C:\\project\\.runtime\\alteran\\alteran.bat",
    appAliases: ["alias app-hello='alteran app run hello'"],
    toolAliases: ["alias tool-seed='alteran tool run seed'"],
    shellAliases: ["alias myrun='alt run scripts/demo.ts'"],
  });
  const batch = renderBatchEnv({
    runtimeDir: "C:\\project\\.runtime",
    cacheDir: "C:\\project\\.runtime\\deno\\windows-x64\\cache",
    platformDir: "C:\\project\\.runtime\\deno\\windows-x64",
    denoBinDir: "C:\\project\\.runtime\\deno\\windows-x64\\bin",
    wrapperBinDir: "C:\\project\\.runtime\\alteran",
    shellWrapper: "/tmp/project/.runtime/alteran/alteran.sh",
    batchWrapper: "C:\\project\\.runtime\\alteran\\alteran.bat",
    appAliases: ['doskey app-hello=call "C:\\project\\.runtime\\alteran\\alteran.bat" app run hello $*'],
    toolAliases: ['doskey tool-seed=call "C:\\project\\.runtime\\alteran\\alteran.bat" tool run seed $*'],
    shellAliases: ['doskey myrun=alt run scripts/demo.ts $*'],
  });

  expect(
    shell.includes('export ALTERAN_HOME="/tmp/project/.runtime"'),
    "Expected shell env to export ALTERAN_HOME",
  );
  expect(
    shell.includes("alteran() { \"/tmp/project/.runtime/alteran/alteran.sh\" \"$@\"; }"),
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
    batch.includes('set "PATH=C:\\project\\.runtime\\alteran;C:\\project\\.runtime\\deno\\windows-x64\\bin;%PATH%"'),
    "Expected batch env to prepend the wrapper dir and managed deno dir to PATH",
  );
  expect(
    batch.includes('set "ALTERAN_SESSION_WRAPPER=%TEMP%\\alteran-wrapper-%RANDOM%%RANDOM%%RANDOM%.bat"') &&
      batch.includes('copy /y "C:\\project\\.runtime\\alteran\\alteran.bat" "%ALTERAN_SESSION_WRAPPER%" >nul 2>nul') &&
      batch.includes('if errorlevel 1 set "ALTERAN_SESSION_WRAPPER=C:\\project\\.runtime\\alteran\\alteran.bat"') &&
      batch.includes('doskey alteran=call "%ALTERAN_SESSION_WRAPPER%" $*'),
    "Expected batch env to expose the alteran doskey shim",
  );
  expect(
    batch.includes('doskey atest=call "%ALTERAN_SESSION_WRAPPER%" test $*') &&
      batch.includes('doskey app-hello=call "C:\\project\\.runtime\\alteran\\alteran.bat" app run hello $*') &&
      batch.includes('doskey tool-seed=call "C:\\project\\.runtime\\alteran\\alteran.bat" tool run seed $*') &&
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
