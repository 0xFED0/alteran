import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { copyDirectory, exists, removeIfExists } from "../../src/alteran/fs.ts";
import { runCli } from "../../src/alteran/mod.ts";
import { resetExamples } from "../../examples/reset.ts";

export interface ExampleCatalogEntry {
  selector: string;
  root: string;
  operationalRoot: string;
  mode: "managed" | "bootstrap-empty" | "standalone-app";
  repoTestFiles: string[];
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BOOTSTRAP_EMPTY_FOLDER_EXCLUDES = new Set([
  ".runtime",
  "activate",
  "activate.bat",
  "alteran.json",
  "apps",
  "deno.json",
  "deno.lock",
  "dist",
  "libs",
  "tests",
  "tools",
]);
const STANDALONE_RUNTIME_EXCLUDES = new Set([
  "standalone-clock/.runtime",
  "standalone-clock/app",
  "standalone-clock/app.bat",
  "standalone-clock/dist",
]);

export const EXAMPLE_CATALOG: ExampleCatalogEntry[] = [
  {
    selector: "01-bootstrap-empty-folder",
    root: "01-bootstrap-empty-folder",
    operationalRoot: "01-bootstrap-empty-folder",
    mode: "bootstrap-empty",
    repoTestFiles: ["tests/examples/bootstrap_empty_project_test.ts"],
  },
  {
    selector: "02-multi-app-workspace",
    root: "02-multi-app-workspace",
    operationalRoot: "02-multi-app-workspace",
    mode: "managed",
    repoTestFiles: ["tests/examples/multi_app_workspace_test.ts"],
  },
  {
    selector: "03-tools-workspace",
    root: "03-tools-workspace",
    operationalRoot: "03-tools-workspace",
    mode: "managed",
    repoTestFiles: ["tests/examples/tools_workspace_test.ts"],
  },
  {
    selector: "04-managed-vs-plain-deno",
    root: "04-managed-vs-plain-deno",
    operationalRoot: "04-managed-vs-plain-deno",
    mode: "managed",
    repoTestFiles: ["tests/examples/managed_vs_plain_test.ts"],
  },
  {
    selector: "05-logging-run-tree",
    root: "05-logging-run-tree",
    operationalRoot: "05-logging-run-tree",
    mode: "managed",
    repoTestFiles: ["tests/examples/logging_run_tree_test.ts"],
  },
  {
    selector: "06-refresh-reimport",
    root: "06-refresh-reimport",
    operationalRoot: "06-refresh-reimport",
    mode: "managed",
    repoTestFiles: ["tests/examples/refresh_reimport_test.ts"],
  },
  {
    selector: "07-compact-transfer-ready",
    root: "07-compact-transfer-ready",
    operationalRoot: "07-compact-transfer-ready",
    mode: "managed",
    repoTestFiles: ["tests/examples/compact_transfer_ready_test.ts"],
  },
  {
    selector: "advanced/logtape-categories",
    root: "advanced/logtape-categories",
    operationalRoot: "advanced/logtape-categories",
    mode: "managed",
    repoTestFiles: ["tests/examples/advanced_examples_test.ts"],
  },
  {
    selector: "advanced/standalone-app-runtime",
    root: "advanced/standalone-app-runtime",
    operationalRoot: "advanced/standalone-app-runtime/standalone-clock",
    mode: "standalone-app",
    repoTestFiles: ["tests/examples/advanced_examples_test.ts"],
  },
];

function isHelpToken(value?: string): boolean {
  return value === "help" || value === "--help" || value === "-h";
}

function normalizeSelector(input: string): string {
  return input.replaceAll("\\", "/").replace(/^\.\/+/u, "")
    .replace(/^examples\//u, "").replace(/\/+$/u, "");
}

export function resolveExampleSelections(
  selectors: string[] = [],
): ExampleCatalogEntry[] {
  if (selectors.length === 0) {
    return [...EXAMPLE_CATALOG];
  }

  const bySelector = new Map<string, ExampleCatalogEntry>();
  for (const entry of EXAMPLE_CATALOG) {
    bySelector.set(entry.selector, entry);
    bySelector.set(entry.root, entry);
    bySelector.set(entry.operationalRoot, entry);
  }

  const resolved: ExampleCatalogEntry[] = [];
  for (const selector of selectors) {
    const normalized = normalizeSelector(selector);
    const entry = bySelector.get(normalized);
    if (!entry) {
      throw new Error(
        `Unknown example selector: ${selector}. Expected one of: ${
          EXAMPLE_CATALOG.map((item) => item.selector).join(", ")
        }`,
      );
    }
    if (!resolved.includes(entry)) {
      resolved.push(entry);
    }
  }
  return resolved;
}

function prefixedHostPath(env: Record<string, string>): string {
  const hostBinDir = dirname(Deno.execPath());
  const separator = Deno.build.os === "windows" ? ";" : ":";
  const currentPath = env.PATH ?? Deno.env.get("PATH") ?? "";
  return `${hostBinDir}${separator}${currentPath}`;
}

async function runStandaloneSetup(
  appDir: string,
  env: Record<string, string> = {},
): Promise<void> {
  const command = Deno.build.os === "windows"
    ? new Deno.Command("cmd", {
      args: ["/d", "/c", "setup.bat"],
      cwd: appDir,
      env: {
        ...Deno.env.toObject(),
        ...env,
        PATH: prefixedHostPath({ ...Deno.env.toObject(), ...env }),
      },
      stdout: "inherit",
      stderr: "inherit",
    })
    : new Deno.Command("sh", {
      args: ["-c", "./setup"],
      cwd: appDir,
      env: {
        ...Deno.env.toObject(),
        ...env,
        PATH: prefixedHostPath({ ...Deno.env.toObject(), ...env }),
      },
      stdout: "inherit",
      stderr: "inherit",
    });
  const output = await command.output();
  if (!output.success) {
    throw new Error(`standalone example setup failed in ${appDir}`);
  }
}

async function createTempCopyForEntry(
  repoRoot: string,
  entry: ExampleCatalogEntry,
): Promise<string> {
  const sourceDir = join(repoRoot, "examples", entry.root);
  const tempParentDir = await Deno.makeTempDir({
    prefix: `alteran-examples-tool-${entry.selector.replaceAll("/", "-")}-`,
  });
  const tempDir = join(tempParentDir, "example");

  if (entry.mode === "managed") {
    const exitCode = await runCli([
      "compact-copy",
      tempDir,
      `--source=${sourceDir}`,
    ]);
    if (exitCode !== 0) {
      throw new Error(`compact-copy failed for example ${entry.selector}`);
    }
    return tempDir;
  }

  await copyDirectory(sourceDir, tempDir, {
    filter: (absolutePath) => {
      const relativePath = absolutePath === sourceDir
        ? ""
        : absolutePath.slice(sourceDir.length + 1).replaceAll("\\", "/");
      if (!relativePath) {
        return true;
      }
      if (relativePath === ".runtime" || relativePath.startsWith(".runtime/")) {
        return false;
      }
      const excluded = entry.mode === "bootstrap-empty"
        ? BOOTSTRAP_EMPTY_FOLDER_EXCLUDES
        : STANDALONE_RUNTIME_EXCLUDES;
      if (
        excluded.has(relativePath) ||
        [...excluded].some((item) => relativePath.startsWith(`${item}/`))
      ) {
        return false;
      }
      return true;
    },
  });
  return tempDir;
}

export async function createExampleTempCopy(
  entry: ExampleCatalogEntry,
  repoRoot = REPO_ROOT,
): Promise<string> {
  return await createTempCopyForEntry(repoRoot, entry);
}

async function runRepositoryTestFiles(
  repoRoot: string,
  files: string[],
): Promise<void> {
  if (files.length === 0) {
    return;
  }
  const output = await new Deno.Command(Deno.execPath(), {
    args: ["test", "-A", ...files],
    cwd: repoRoot,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (!output.success) {
    throw new Error(`repository example tests failed: ${files.join(", ")}`);
  }
}

async function runInternalExampleTests(
  tempOperationalRoot: string,
): Promise<void> {
  const testsDir = join(tempOperationalRoot, "tests");
  if (!(await exists(testsDir))) {
    throw new Error(
      `example has no associated repository-level test and no internal tests: ${tempOperationalRoot}`,
    );
  }
  const exitCode = await runCli([
    "from",
    "dir",
    tempOperationalRoot,
    "test",
    "-A",
    "./tests",
  ]);
  if (exitCode !== 0) {
    throw new Error(`internal example tests failed for ${tempOperationalRoot}`);
  }
}

async function setupExampleEntry(entry: ExampleCatalogEntry, repoRoot: string): Promise<void> {
  const operationalRoot = join(repoRoot, "examples", entry.operationalRoot);
  if (entry.mode === "standalone-app") {
    await runStandaloneSetup(operationalRoot);
    return;
  }
  const exitCode = await runCli(["setup", operationalRoot]);
  if (exitCode !== 0) {
    throw new Error(`setup failed for ${entry.selector}`);
  }
}

async function refreshExampleEntry(entry: ExampleCatalogEntry, repoRoot: string): Promise<void> {
  const operationalRoot = join(repoRoot, "examples", entry.operationalRoot);
  if (entry.mode === "standalone-app") {
    await runStandaloneSetup(operationalRoot);
    return;
  }
  const exitCode = await runCli(["from", "dir", operationalRoot, "refresh"]);
  if (exitCode !== 0) {
    throw new Error(`refresh failed for ${entry.selector}`);
  }
}

async function cleanExampleEntry(entry: ExampleCatalogEntry, repoRoot: string): Promise<void> {
  if (entry.mode === "standalone-app") {
    await resetExamples(repoRoot, [entry.selector]);
    return;
  }
  const operationalRoot = join(repoRoot, "examples", entry.operationalRoot);
  const exitCode = await runCli(["from", "dir", operationalRoot, "clean", "all"]);
  if (exitCode !== 0) {
    throw new Error(`clean failed for ${entry.selector}`);
  }
}

async function compactExampleEntry(entry: ExampleCatalogEntry, repoRoot: string): Promise<void> {
  if (entry.mode === "standalone-app") {
    await resetExamples(repoRoot, [entry.selector]);
    return;
  }
  const operationalRoot = join(repoRoot, "examples", entry.operationalRoot);
  const exitCode = await runCli(["compact", operationalRoot, "-y"]);
  if (exitCode !== 0) {
    throw new Error(`compact failed for ${entry.selector}`);
  }
}

async function testExampleEntries(
  entries: ExampleCatalogEntry[],
  repoRoot: string,
): Promise<void> {
  await resetExamples(repoRoot, entries.map((entry) => entry.selector));

  const repositoryTestFiles = [...new Set(entries.flatMap((entry) => entry.repoTestFiles))];
  if (repositoryTestFiles.length > 0) {
    await runRepositoryTestFiles(repoRoot, repositoryTestFiles);
    return;
  }

  for (const entry of entries) {
    const tempDir = await createTempCopyForEntry(repoRoot, entry);
    const tempOperationalRoot = join(tempDir, entry.operationalRoot.slice(entry.root.length).replace(/^[/\\]/u, ""));

    try {
      if (entry.mode === "standalone-app") {
        await runStandaloneSetup(tempOperationalRoot);
      } else {
        const exitCode = await runCli(["setup", tempOperationalRoot]);
        if (exitCode !== 0) {
          throw new Error(`setup failed for temp example ${entry.selector}`);
        }
      }
      await runInternalExampleTests(tempOperationalRoot);
    } finally {
      await removeIfExists(dirname(tempDir));
    }
  }
}

export function renderHelp(): string {
  return [
    "alteran repository examples tool",
    "",
    "Usage:",
    "  alteran tool run examples <subcommand> [example-path ...]",
    "",
    "Subcommands:",
    "  reset",
    "  setup",
    "  refresh",
    "  clean",
    "  compact",
    "  test",
    "",
    "Selectors:",
    ...EXAMPLE_CATALOG.map((entry) => `  - ${entry.selector}`),
  ].join("\n");
}

export async function runExamplesTool(
  args: string[],
  options: { repoRoot?: string } = {},
): Promise<number> {
  const repoRoot = options.repoRoot ? resolve(options.repoRoot) : REPO_ROOT;
  const [subcommand, ...selectors] = args;

  if (!subcommand || isHelpToken(subcommand)) {
    console.log(renderHelp());
    return 0;
  }

  const entries = resolveExampleSelections(selectors);

  try {
    switch (subcommand) {
      case "reset":
        console.error(`Resetting examples: ${entries.map((entry) => entry.selector).join(", ")}`);
        await resetExamples(repoRoot, entries.map((entry) => entry.selector));
        return 0;
      case "setup":
        for (const entry of entries) {
          console.error(`Setting up example: ${entry.selector}`);
          await setupExampleEntry(entry, repoRoot);
        }
        return 0;
      case "refresh":
        for (const entry of entries) {
          console.error(`Refreshing example: ${entry.selector}`);
          await refreshExampleEntry(entry, repoRoot);
        }
        return 0;
      case "clean":
        for (const entry of entries) {
          console.error(`Cleaning example: ${entry.selector}`);
          await cleanExampleEntry(entry, repoRoot);
        }
        return 0;
      case "compact":
        for (const entry of entries) {
          console.error(`Compacting example: ${entry.selector}`);
          await compactExampleEntry(entry, repoRoot);
        }
        return 0;
      case "test":
        console.error(`Testing examples: ${entries.map((entry) => entry.selector).join(", ")}`);
        await testExampleEntries(entries, repoRoot);
        return 0;
      default:
        throw new Error(`Unknown examples subcommand: ${subcommand}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Alteran examples error: ${message}`);
    return 1;
  }
}

export async function main(args: string[]): Promise<void> {
  Deno.exit(await runExamplesTool(args));
}
