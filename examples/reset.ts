import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ensureDir,
  exists,
  listDirectSubdirectories,
  removeIfExists,
  writeTextFileIfChanged,
} from "../src/alteran/fs.ts";

interface ResetTarget {
  selector: string;
  root: string;
  syncRepositoryBootstrap: boolean;
  remove: string[];
  removeGeneratedAppArtifacts: boolean;
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const RESET_TARGETS: ResetTarget[] = [
  {
    selector: "01-bootstrap-empty-folder",
    root: "01-bootstrap-empty-folder",
    syncRepositoryBootstrap: true,
    remove: [
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
    ],
    removeGeneratedAppArtifacts: false,
  },
  {
    selector: "02-multi-app-workspace",
    root: "02-multi-app-workspace",
    syncRepositoryBootstrap: true,
    remove: [
      ".runtime",
      "activate",
      "activate.bat",
      "deno.lock",
      "dist",
      "libs/.keep",
      "tools",
    ],
    removeGeneratedAppArtifacts: true,
  },
  {
    selector: "03-tools-workspace",
    root: "03-tools-workspace",
    syncRepositoryBootstrap: true,
    remove: [
      ".runtime",
      "activate",
      "activate.bat",
      "apps",
      "deno.lock",
      "dist",
      "libs/.keep",
    ],
    removeGeneratedAppArtifacts: false,
  },
  {
    selector: "04-managed-vs-plain-deno",
    root: "04-managed-vs-plain-deno",
    syncRepositoryBootstrap: true,
    remove: [
      ".runtime",
      "activate",
      "activate.bat",
      "apps",
      "deno.lock",
      "dist",
      "libs",
    ],
    removeGeneratedAppArtifacts: false,
  },
  {
    selector: "05-logging-run-tree",
    root: "05-logging-run-tree",
    syncRepositoryBootstrap: true,
    remove: [
      ".runtime",
      "activate",
      "activate.bat",
      "apps",
      "deno.lock",
      "dist",
      "libs/.keep",
    ],
    removeGeneratedAppArtifacts: false,
  },
  {
    selector: "06-refresh-reimport",
    root: "06-refresh-reimport",
    syncRepositoryBootstrap: true,
    remove: [
      ".runtime",
      "activate",
      "activate.bat",
      "deno.lock",
      "dist",
      "libs/.keep",
      "tools",
    ],
    removeGeneratedAppArtifacts: true,
  },
  {
    selector: "07-compact-transfer-ready",
    root: "07-compact-transfer-ready",
    syncRepositoryBootstrap: true,
    remove: [
      ".runtime",
      "activate",
      "activate.bat",
      "deno.lock",
      "dist",
      "libs/.keep",
    ],
    removeGeneratedAppArtifacts: true,
  },
  {
    selector: "advanced/logtape-categories",
    root: "advanced/logtape-categories",
    syncRepositoryBootstrap: true,
    remove: [
      ".runtime",
      "activate",
      "activate.bat",
      "apps",
      "deno.lock",
      "dist",
      "libs/.keep",
    ],
    removeGeneratedAppArtifacts: false,
  },
  {
    selector: "advanced/standalone-app-runtime",
    root: "advanced/standalone-app-runtime/standalone-clock",
    syncRepositoryBootstrap: false,
    remove: [
      ".runtime",
      "app",
      "app.bat",
      "dist",
    ],
    removeGeneratedAppArtifacts: false,
  },
];

const GENERATED_APP_ARTIFACTS = [
  ".runtime",
  "app",
  "app.bat",
  "setup",
  "setup.bat",
] as const;

function normalizeSelector(input: string): string {
  const normalized = input.replaceAll("\\", "/").replace(/^\.\/+/u, "")
    .replace(/^examples\//u, "").replace(/\/+$/u, "");
  return normalized;
}

function resolveTargets(selectors: string[]): ResetTarget[] {
  if (selectors.length === 0) {
    return [...RESET_TARGETS];
  }

  const bySelector = new Map<string, ResetTarget>();
  for (const target of RESET_TARGETS) {
    bySelector.set(target.selector, target);
    bySelector.set(target.root, target);
  }

  const resolved: ResetTarget[] = [];
  for (const selector of selectors) {
    const normalized = normalizeSelector(selector);
    const target = bySelector.get(normalized);
    if (!target) {
      throw new Error(
        `Unknown example selector: ${selector}. Expected one of: ${
          RESET_TARGETS.map(({ selector }) => selector).join(", ")
        }`,
      );
    }
    if (!resolved.includes(target)) {
      resolved.push(target);
    }
  }
  return resolved;
}

async function syncRepositoryBootstrap(targetDir: string): Promise<void> {
  const rootSetup = await Deno.readTextFile(join(REPO_ROOT, "setup"));
  const rootSetupBat = await Deno.readTextFile(join(REPO_ROOT, "setup.bat"));
  await writeTextFileIfChanged(join(targetDir, "setup"), rootSetup);
  await writeTextFileIfChanged(join(targetDir, "setup.bat"), rootSetupBat);
  if (Deno.build.os !== "windows") {
    await Deno.chmod(join(targetDir, "setup"), 0o755);
  }
}

export async function syncExampleBootstrap(
  repoRoot: string = REPO_ROOT,
  selectors: string[] = [],
): Promise<void> {
  const examplesRoot = join(repoRoot, "examples");
  const targets = resolveTargets(selectors).filter((target) =>
    target.syncRepositoryBootstrap
  );

  for (const target of targets) {
    const targetDir = join(examplesRoot, target.root);
    await ensureDir(targetDir);
    await syncRepositoryBootstrap(targetDir);
  }
}

async function removeGeneratedAppArtifacts(targetDir: string): Promise<void> {
  const appsDir = join(targetDir, "apps");
  if (!(await exists(appsDir))) {
    return;
  }

  for (const appName of await listDirectSubdirectories(appsDir)) {
    const appDir = join(appsDir, appName);
    for (const relativePath of GENERATED_APP_ARTIFACTS) {
      await removeIfExists(join(appDir, relativePath));
    }
  }
}

export async function resetExamples(
  repoRoot: string = REPO_ROOT,
  selectors: string[] = [],
): Promise<void> {
  const examplesRoot = join(repoRoot, "examples");
  const targets = resolveTargets(selectors);

  for (const target of targets) {
    const targetDir = join(examplesRoot, target.root);
    await ensureDir(targetDir);

    for (const relativePath of target.remove) {
      await removeIfExists(join(targetDir, relativePath));
    }

    if (target.removeGeneratedAppArtifacts) {
      await removeGeneratedAppArtifacts(targetDir);
    }

    if (target.syncRepositoryBootstrap) {
      const rootSetup = await Deno.readTextFile(join(repoRoot, "setup"));
      const rootSetupBat = await Deno.readTextFile(join(repoRoot, "setup.bat"));
      await writeTextFileIfChanged(join(targetDir, "setup"), rootSetup);
      await writeTextFileIfChanged(join(targetDir, "setup.bat"), rootSetupBat);
      if (Deno.build.os !== "windows") {
        await Deno.chmod(join(targetDir, "setup"), 0o755);
      }
    }
  }
}

export function renderHelp(): string {
  return [
    "Usage:",
    "  deno run -A ./examples/reset.ts [example-path ...]",
    "",
    "Resets committed examples back to their intended source-first baseline by",
    "deleting known generated artifacts and resynchronizing managed example",
    "bootstrap scripts with the repository root.",
    "",
    "Example selectors:",
    ...RESET_TARGETS.map((target) => `  - ${target.selector}`),
  ].join("\n");
}

export async function main(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(renderHelp());
    return;
  }

  await resetExamples(REPO_ROOT, args);
}

if (import.meta.main) {
  await main(Deno.args);
}
