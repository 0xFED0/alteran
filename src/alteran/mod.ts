import { basename, dirname, join, resolve } from "node:path";

import { readAlteranConfig, resolveRegisteredPath } from "./config.ts";
import {
  addApp,
  addTool,
  cleanProject,
  cleanProjectScopes,
  compactCopyProject,
  compactProject,
  generateBatchEnv,
  generateShellEnv,
  listRegistry,
  passthroughDeno,
  purgeApp,
  purgeTool,
  refreshProject,
  reimportCategory,
  removeApp,
  removeTool,
  resolveActiveProjectDir,
  runApp,
  setupProject,
  setupStandaloneApp,
  runDenoX,
  runScript,
  runTask,
  runTool,
  upgradeTargets,
  useDenoVersion,
} from "./runtime.ts";
import { exists } from "./fs.ts";
import type { AppConfig } from "./types.ts";

export {
  addApp,
  addTool,
  cleanProject,
  compactCopyProject,
  compactProject,
  generateBatchEnv,
  generateShellEnv,
  passthroughDeno,
  refreshProject,
  resolveActiveProjectDir,
  runApp,
  runScript,
  setupProject,
  runTask,
  runTool,
  useDenoVersion,
};

function printHelp(): void {
  console.log(`Alteran

Commands:
  alteran setup [dir]
  alteran external <path-to-json> <command> [args...]
  alteran from app <name> <command> [args...]
  alteran from dir <project-dir> <command> [args...]
  alteran refresh
  alteran shellenv [dir] [--shell=sh|batch]
  alteran app add|rm|purge|ls|run|setup <name>
  alteran tool add|rm|purge|ls|run <name>
  alteran reimport apps|tools <dir>
  alteran clean <scope> [<scope> ...]
  alteran compact [dir]
  alteran compact-copy <destination> [--source=<project-dir>]
  alteran run <file> [args...]
  alteran task <name> [args...]
  alteran test [filters/flags...]
  alteran deno <args...>
  alteran x <module> [args...]
  alteran update
  alteran upgrade [--alteran[=version]] [--deno[=version]]
  alteran use --deno=<version>

Help:
  alteran help
  alteran <command> --help

Aliases:
  alt    -> alteran
  arun   -> alteran run
  atask  -> alteran task
  atest  -> alteran test
  ax     -> alteran x
  adeno  -> alteran deno`);
}

function printAppHelp(): void {
  console.log(`alteran app

Manage registered applications.

Usage:
  alteran app add <name>
  alteran app rm <name>
  alteran app purge <name>
  alteran app ls
  alteran app run <name> [args...]
  alteran app setup <path>

Commands:
  add     Register an app and scaffold it if missing.
  rm      Remove an app from Alteran registry only.
  purge   Remove app files and unregister the app.
  ls      List registered apps.
  run     Run the app task from apps/<name>/deno.json.
  setup   Create a standalone app scaffold outside the main repo.

Help:
  alteran app --help
  alteran app <command> --help`);
}

function printToolHelp(): void {
  console.log(`alteran tool

Manage registered tools.

Usage:
  alteran tool add <name>
  alteran tool rm <name>
  alteran tool purge <name>
  alteran tool ls
  alteran tool run <name> [args...]

Commands:
  add     Register a tool and scaffold it if missing.
  rm      Remove a tool from Alteran registry only.
  purge   Remove tool files and unregister the tool.
  ls      List registered tools.
  run     Run the tool through Alteran-managed Deno.

Help:
  alteran tool --help
  alteran tool <command> --help`);
}

function printReimportHelp(): void {
  console.log(`alteran reimport

Re-scan a directory and import discovered apps or tools.

Usage:
  alteran reimport apps <dir>
  alteran reimport tools <dir>`);
}

function printCleanHelp(): void {
  console.log(`alteran clean

Remove generated or recoverable project-local state.

Usage:
  alteran clean <scope> [<scope> ...]

Scopes:
  cache         Remove .runtime/deno/{platform}/cache
  runtime       Remove generated runtime state under .runtime/
  env           Remove generated activate / activate.bat
  app-runtimes  Remove nested apps/*/.runtime/
  logs          Remove .runtime/logs/
  builds        Remove dist/ output
  all           Full safe cleanup of regeneratable runtime state

Help:
  alteran clean --help`);
}

function printRunHelp(): void {
  console.log(`alteran run

Run a script with Alteran-managed Deno and preload initialization.

Usage:
  alteran run <file> [args...]`);
}

function printCompactHelp(): void {
  console.log(`alteran compact

Reduce the project to a bootstrap-ready transferable state.

Usage:
  alteran compact [dir] [-y|--yes|-f|--force]
  alteran compact [dir] [-n|--no]

Behavior:
  - runs safe cleanup equivalent to clean all
  - removes the root .runtime/ directory completely
  - removes nested apps/*/.runtime/ directories
  - removes dist/ output completely
  - removes generated activate / activate.bat
  - preserves user source files, configs, and setup scripts
  - asks for confirmation before making destructive changes unless -y/-f is set
  - cancels immediately when -n is set

After compact, the project should be re-hydratable from scratch through:
  ./setup
  setup.bat`);
}

function printCompactCopyHelp(): void {
  console.log(`alteran compact-copy

Create a compact bootstrap-ready copy without mutating the source project.

Usage:
  alteran compact-copy <destination> [--source=<project-dir>]

Behavior:
  - copies the source project into a new destination
  - omits the same generated runtime, activation, and build artifacts that compact removes
  - leaves the source project unchanged
  - defaults the source project to the current active Alteran project when --source is omitted`);
}

function printCompactWarning(projectDir: string): void {
  console.error(
    `Alteran compact will reduce this project to a bootstrap-ready state:
  ${projectDir}

It will remove:
  - .runtime/
  - apps/*/.runtime/
  - dist/
  - activate / activate.bat

It will keep:
  - setup / setup.bat
  - alteran.json / deno.json / deno.lock
  - .env / .gitignore
  - apps/ tools/ libs/ tests/
  - user-authored source and config files

The project should still be re-hydratable later through setup.`,
  );
}

function isYesFlag(value: string): boolean {
  return value === "-y" || value === "--yes" || value === "-f" ||
    value === "--force";
}

function isNoFlag(value: string): boolean {
  return value === "-n" || value === "--no";
}

function parseCompactArgs(
  rest: string[],
  options: { forcedProjectDir?: string } = {},
): {
  projectDir: string;
  hasYes: boolean;
  hasNo: boolean;
} {
  let projectDir = options.forcedProjectDir ?? null;
  let hasYes = false;
  let hasNo = false;

  for (const arg of rest) {
    if (isYesFlag(arg)) {
      hasYes = true;
      continue;
    }
    if (isNoFlag(arg)) {
      hasNo = true;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unsupported compact flag: ${arg}`);
    }
    if (options.forcedProjectDir) {
      throw new Error("external compact does not accept a second target dir");
    }
    if (projectDir !== null) {
      throw new Error(`alteran compact does not accept multiple target dirs: ${arg}`);
    }
    projectDir = resolve(Deno.cwd(), arg);
  }

  return {
    projectDir: projectDir ?? "",
    hasYes,
    hasNo,
  };
}

function parseCompactCopyArgs(
  rest: string[],
  options: { forcedProjectDir?: string } = {},
): {
  sourceProjectDir: string;
  destinationDir: string;
} {
  let sourceProjectDir = options.forcedProjectDir ?? null;
  let destinationDir: string | null = null;

  for (const arg of rest) {
    if (arg.startsWith("--source=")) {
      if (options.forcedProjectDir) {
        throw new Error("external compact-copy does not accept --source");
      }
      sourceProjectDir = resolve(Deno.cwd(), arg.slice("--source=".length));
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unsupported compact-copy flag: ${arg}`);
    }
    if (destinationDir !== null) {
      throw new Error(
        `alteran compact-copy does not accept multiple destinations: ${arg}`,
      );
    }
    destinationDir = resolve(Deno.cwd(), arg);
  }

  if (destinationDir === null) {
    throw new Error("alteran compact-copy requires a destination directory");
  }

  return {
    sourceProjectDir: sourceProjectDir ?? "",
    destinationDir,
  };
}

async function confirmCompact(projectDir: string): Promise<"yes" | "no"> {
  printCompactWarning(projectDir);

  if (!Deno.stdin.isTerminal()) {
    throw new Error(
      "alteran compact requires confirmation in interactive mode. Use -y/-f to proceed or -n to cancel.",
    );
  }

  const answer = globalThis.prompt?.("Proceed with alteran compact? [y/N]") ??
    null;
  const normalized = answer?.trim().toLowerCase() ?? "";
  return normalized === "y" || normalized === "yes" ? "yes" : "no";
}

function printTaskHelp(): void {
  console.log(`alteran task

Run a Deno task inside the Alteran environment.

Usage:
  alteran task <name> [args...]`);
}

function printTestHelp(): void {
  console.log(`alteran test

Shortcut for "alteran deno test".

Usage:
  alteran test [filters/flags...]

Examples:
  alteran test
  alteran test tests/alteran_test.ts
  alteran test --filter activate`);
}

function printDenoHelp(): void {
  console.log(`alteran deno

Run raw Deno commands inside the Alteran-managed environment.

Usage:
  alteran deno <args...>

Examples:
  alteran deno test
  alteran deno task build
  alteran deno run -A script.ts`);
}

function printXHelp(): void {
  console.log(`alteran x

Run a remote module inside the Alteran-managed environment.

Usage:
  alteran x <module> [args...]`);
}

function printUpdateHelp(): void {
  console.log(`alteran update

Run Deno dependency update flow for the current project.

Usage:
  alteran update [extra deno outdated flags...]`);
}

function printUpgradeHelp(): void {
  console.log(`alteran upgrade

Upgrade Alteran runtime and/or the managed Deno runtime.

Usage:
  alteran upgrade [--alteran[=version]] [--deno[=version]]
  alteran upgrade --alt[=version]

Examples:
  alteran upgrade
  alteran upgrade --alteran
  alteran upgrade --deno
  alteran upgrade --alteran=1.2.3 --deno=2.4.1`);
}

function printUseHelp(): void {
  console.log(`alteran use

Change project configuration for managed tool versions.

Usage:
  alteran use --deno=<version>`);
}

function printExternalHelp(): void {
  console.log(`alteran external

Run an Alteran command in an explicitly targeted foreign project context.

Usage:
  alteran external <path-to-json> <command> [args...]
  ALTERAN_EXTERNAL_CTX=<path-to-json> alteran external <command> [args...]

Supported anchors:
  alteran.json   Target the owning Alteran project directly.
  app.json       Target the owning Alteran project through a specific managed app.

Rules:
  - a positional <path-to-json> takes precedence over ALTERAN_EXTERNAL_CTX
  - deno.json is not a valid external context anchor
  - use "alteran from ..." when you want to become the target context first

Examples:
  alteran external ../other/alteran.json tool run seed
  alteran external ../other/apps/hello/app.json app
  ALTERAN_EXTERNAL_CTX=../other/alteran.json alteran external task build`);
}

function printFromHelp(): void {
  console.log(`alteran from

Run an Alteran command as if execution had first been rebased into another target context.

Usage:
  alteran from app <name> <command> [args...]
  alteran from dir <project-dir> <command> [args...]

Targets:
  app   Resolve a registered app from the current active Alteran project.
  dir   Resolve an explicit Alteran project directory.

Rules:
  - from becomes the target context before interpreting the remaining command
  - from may auto-run target-local setup first if the target is not initialized yet
  - from does not use deno.json as an Alteran context anchor

Examples:
  alteran from dir ../examples/02-multi-app-workspace tool run seed
  alteran from app hello app red blue`);
}

function isHelpToken(value?: string): boolean {
  return value === "help" || value === "--help" || value === "-h";
}

function parseUpgradeOption(
  flag: string,
  longName: string,
  shortName: string,
): string | true | undefined {
  if (flag === `--${longName}` || flag === `--${shortName}`) {
    return true;
  }
  if (flag.startsWith(`--${longName}=`)) {
    return flag.slice(longName.length + 3);
  }
  if (flag.startsWith(`--${shortName}=`)) {
    return flag.slice(shortName.length + 3);
  }
  return undefined;
}

function parseShellenvArgs(rest: string[]): {
  projectDir: string;
  format: "shell" | "batch";
} {
  let targetDir: string | undefined;
  let format: "shell" | "batch" = "shell";

  for (const arg of rest) {
    if (arg === "--shell=batch" || arg === "--shell=bat" ||
      arg === "--shell=cmd") {
      format = "batch";
      continue;
    }
    if (arg === "--shell=sh" || arg === "--shell=shell") {
      format = "shell";
      continue;
    }
    if (arg.startsWith("--shell=")) {
      throw new Error(`Unsupported shellenv format: ${arg.slice(8)}`);
    }
    if (targetDir) {
      throw new Error(`shellenv does not accept multiple target dirs: ${arg}`);
    }
    targetDir = arg;
  }

  return {
    projectDir: targetDir ? resolve(Deno.cwd(), targetDir) : Deno.cwd(),
    format,
  };
}

interface ExternalContext {
  anchorPath: string;
  anchorType: "alteran" | "app";
  projectDir: string;
  appName?: string;
}

interface FromContext {
  targetType: "app" | "dir";
  target: string;
  commandArgs: string[];
}

const ALTERAN_CONTEXT_ENV_KEYS = [
  "ALTERAN_HOME",
  "ALTERAN_RUN_ID",
  "ALTERAN_ROOT_RUN_ID",
  "ALTERAN_PARENT_RUN_ID",
  "ALTERAN_ROOT_LOG_DIR",
  "ALTERAN_LOG_MODE",
  "ALTERAN_LOG_CONTEXT_JSON",
  "ALTERAN_LOGTAPE_ENABLED",
] as const;

async function findOwningAlteranProject(
  startDir: string,
): Promise<string | null> {
  let currentDir = resolve(startDir);
  while (true) {
    if (await exists(join(currentDir, "alteran.json"))) {
      return currentDir;
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

async function resolveExternalContext(anchorInput: string): Promise<ExternalContext> {
  const anchorPath = resolve(Deno.cwd(), anchorInput);
  if (!(await exists(anchorPath))) {
    throw new Error(`external context anchor does not exist: ${anchorInput}`);
  }

  switch (basename(anchorPath)) {
    case "alteran.json":
      return {
        anchorPath,
        anchorType: "alteran",
        projectDir: dirname(anchorPath),
      };
    case "app.json": {
      const appDir = dirname(anchorPath);
      const projectDir = await findOwningAlteranProject(appDir);
      if (projectDir === null) {
        throw new Error(
          "app.json external anchors are only supported for apps owned by an Alteran project",
        );
      }
      const appConfig = JSON.parse(await Deno.readTextFile(anchorPath)) as Partial<
        AppConfig
      >;
      const appName = typeof appConfig.name === "string" && appConfig.name.trim()
        ? appConfig.name.trim()
        : typeof appConfig.id === "string" && appConfig.id.trim()
        ? appConfig.id.trim()
        : basename(appDir);
      return {
        anchorPath,
        anchorType: "app",
        projectDir,
        appName,
      };
    }
    case "deno.json":
    case "deno.jsonc":
      throw new Error(
        "deno.json is not a valid external context anchor; use alteran.json or app.json",
      );
    default:
      throw new Error(
        "external requires an explicit alteran.json or app.json anchor",
      );
  }
}

async function withIsolatedAlteranContext<T>(
  fn: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const key of ALTERAN_CONTEXT_ENV_KEYS) {
    previous.set(key, Deno.env.get(key));
    Deno.env.delete(key);
  }
  try {
    return await fn();
  } finally {
    for (const key of ALTERAN_CONTEXT_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

function parseExternalArgs(rest: string[]): {
  anchorInput: string;
  commandArgs: string[];
} {
  const envAnchor = Deno.env.get("ALTERAN_EXTERNAL_CTX")?.trim();
  if (rest.length === 0) {
    if (envAnchor) {
      return { anchorInput: envAnchor, commandArgs: [] };
    }
    throw new Error(
      "external requires <path-to-json> or ALTERAN_EXTERNAL_CTX to be set",
    );
  }

  const [first, ...remaining] = rest;
  if (first.endsWith(".json")) {
    return { anchorInput: first, commandArgs: remaining };
  }
  if (envAnchor) {
    return { anchorInput: envAnchor, commandArgs: rest };
  }
  throw new Error(
    "external requires <path-to-json> or ALTERAN_EXTERNAL_CTX to be set",
  );
}

function parseFromArgs(rest: string[]): FromContext {
  const [targetType, target, ...commandArgs] = rest;
  if (!targetType || isHelpToken(targetType)) {
    throw new Error("alteran from requires app|dir and a target");
  }
  if (targetType !== "app" && targetType !== "dir") {
    throw new Error(`Unsupported from target type: ${targetType}`);
  }
  if (!target || isHelpToken(target)) {
    throw new Error(`alteran from ${targetType} requires a target`);
  }
  if (commandArgs.length === 0) {
    throw new Error("alteran from requires a command to run in the target context");
  }
  return { targetType, target, commandArgs };
}

async function runCliInternal(
  argv: string[],
  options: { forcedProjectDir?: string; anchoredAppName?: string } = {},
): Promise<number> {
  const resolveProjectDir = async (): Promise<string> =>
    options.forcedProjectDir ?? await resolveActiveProjectDir();

  const parseForcedShellenvArgs = (rest: string[]): {
    projectDir: string;
    format: "shell" | "batch";
  } => {
    let format: "shell" | "batch" = "shell";
    for (const arg of rest) {
      if (arg === "--shell=batch" || arg === "--shell=bat" ||
        arg === "--shell=cmd") {
        format = "batch";
        continue;
      }
      if (arg === "--shell=sh" || arg === "--shell=shell") {
        format = "shell";
        continue;
      }
      if (arg.startsWith("--shell=")) {
        throw new Error(`Unsupported shellenv format: ${arg.slice(8)}`);
      }
      throw new Error("external shellenv does not accept a second target dir");
    }
    return {
      projectDir: options.forcedProjectDir!,
      format,
    };
  };

  try {
    if (argv.length === 0) {
      printHelp();
      return 0;
    }

    const [command, ...rest] = argv;

    switch (command) {
      case "external": {
        if (rest.length === 0 || isHelpToken(rest[0])) {
          printExternalHelp();
          return 0;
        }
        const { anchorInput, commandArgs } = parseExternalArgs(rest);
        if (commandArgs.length === 0 || isHelpToken(commandArgs[0])) {
          printExternalHelp();
          return 0;
        }
        const externalContext = await resolveExternalContext(anchorInput);
        return await withIsolatedAlteranContext(async () =>
          await runCliInternal(commandArgs, {
            forcedProjectDir: externalContext.projectDir,
            anchoredAppName: externalContext.anchorType === "app"
              ? externalContext.appName
              : undefined,
          })
        );
      }
      case "from": {
        if (rest.length === 0 || isHelpToken(rest[0])) {
          printFromHelp();
          return 0;
        }
        const parsed = parseFromArgs(rest);
        if (isHelpToken(parsed.commandArgs[0])) {
          printFromHelp();
          return 0;
        }
        if (parsed.targetType === "dir") {
          const targetDir = resolve(Deno.cwd(), parsed.target);
          await setupProject(targetDir);
          return await withIsolatedAlteranContext(async () =>
            await runCliInternal(parsed.commandArgs, {
              forcedProjectDir: targetDir,
            })
          );
        }

        const activeProjectDir = await resolveProjectDir();
        const config = await readAlteranConfig(activeProjectDir);
        const appEntry = config.apps[parsed.target];
        if (!appEntry) {
          throw new Error(`from app requires a registered app: ${parsed.target}`);
        }
        const appDir = await resolveRegisteredPath(
          activeProjectDir,
          appEntry,
          `./apps/${parsed.target}`,
        );
        if (!(await exists(join(appDir, "app.json")))) {
          throw new Error(`from app target does not look like an Alteran app: ${parsed.target}`);
        }
        await setupProject(activeProjectDir);
        return await withIsolatedAlteranContext(async () =>
          await runCliInternal(parsed.commandArgs, {
            forcedProjectDir: activeProjectDir,
            anchoredAppName: parsed.target,
          })
        );
      }
      case "setup": {
        if (isHelpToken(rest[0])) {
          console.log("Usage:\n  alteran setup [dir]");
          return 0;
        }
        const targetDir = options.forcedProjectDir
          ? (() => {
            if (rest[0]) {
              throw new Error("external setup does not accept a second target dir");
            }
            return options.forcedProjectDir!;
          })()
          : rest[0]
          ? resolve(Deno.cwd(), rest[0])
          : Deno.cwd();
        await setupProject(targetDir);
        console.error(`Set up Alteran project at ${targetDir}`);
        return 0;
      }
      case "refresh": {
        if (isHelpToken(rest[0])) {
          console.log("Usage:\n  alteran refresh");
          return 0;
        }
        const projectDir = await resolveProjectDir();
        await refreshProject(projectDir);
        console.error(`Refreshed ${projectDir}`);
        return 0;
      }
      case "shellenv": {
        if (rest.some(isHelpToken)) {
          console.log("Usage:\n  alteran shellenv [dir] [--shell=sh|batch]");
          return 0;
        }
        const { projectDir, format } = options.forcedProjectDir
          ? parseForcedShellenvArgs(rest)
          : parseShellenvArgs(rest);
        const output = format === "batch"
          ? await generateBatchEnv(projectDir)
          : await generateShellEnv(projectDir);
        await Deno.stdout.write(new TextEncoder().encode(output));
        return 0;
      }
      case "app": {
        const knownAppActions = new Set([
          "add",
          "rm",
          "purge",
          "ls",
          "run",
          "setup",
        ]);
        const [action, name, ...actionArgs] = rest;
        if (
          options.anchoredAppName &&
          action &&
          !knownAppActions.has(action) &&
          !isHelpToken(action)
        ) {
          const projectDir = await resolveProjectDir();
          return await runApp(
            projectDir,
            options.anchoredAppName,
            rest,
          );
        }
        if (
          options.anchoredAppName &&
          !action
        ) {
          const projectDir = await resolveProjectDir();
          return await runApp(
            projectDir,
            options.anchoredAppName,
            [],
          );
        }
        if (!action || isHelpToken(action) || isHelpToken(name)) {
          printAppHelp();
          return 0;
        }
        const projectDir = await resolveProjectDir();
        switch (action) {
          case "add":
            await addApp(projectDir, name);
            console.error(`Added app ${name}`);
            return 0;
          case "rm":
            await removeApp(projectDir, name);
            console.error(`Removed app ${name} from registry`);
            return 0;
          case "purge":
            await purgeApp(projectDir, name);
            console.error(`Purged app ${name}`);
            return 0;
          case "ls":
            console.log((await listRegistry(projectDir, "apps")).join("\n"));
            return 0;
          case "run":
            return await runApp(projectDir, name, actionArgs);
          case "setup":
            if (!name) {
              throw new Error("app setup requires a target path");
            }
            await setupStandaloneApp(name);
            return 0;
          default:
            throw new Error(
              `Unsupported app command: ${action ?? "<missing>"}`,
            );
        }
      }
      case "tool": {
        const [action, name, ...actionArgs] = rest;
        if (!action || isHelpToken(action) || isHelpToken(name)) {
          printToolHelp();
          return 0;
        }
        const projectDir = await resolveProjectDir();
        switch (action) {
          case "add":
            await addTool(projectDir, name);
            console.error(`Added tool ${name}`);
            return 0;
          case "rm":
            await removeTool(projectDir, name);
            console.error(`Removed tool ${name} from registry`);
            return 0;
          case "purge":
            await purgeTool(projectDir, name);
            console.error(`Purged tool ${name}`);
            return 0;
          case "ls":
            console.log((await listRegistry(projectDir, "tools")).join("\n"));
            return 0;
          case "run":
            return await runTool(projectDir, name, actionArgs);
          default:
            throw new Error(
              `Unsupported tool command: ${action ?? "<missing>"}`,
            );
        }
      }
      case "reimport": {
        const [type, sourceDir] = rest;
        if (!type || isHelpToken(type) || isHelpToken(sourceDir)) {
          printReimportHelp();
          return 0;
        }
        const projectDir = await resolveProjectDir();
        if (type !== "apps" && type !== "tools") {
          throw new Error(`Unsupported reimport type: ${type ?? "<missing>"}`);
        }
        await reimportCategory(projectDir, type, sourceDir ?? `./${type}`);
        console.error(`Reimported ${type} from ${sourceDir ?? `./${type}`}`);
        return 0;
      }
      case "clean": {
        if (rest.length === 0 || rest.some((scope) => isHelpToken(scope))) {
          printCleanHelp();
          return 0;
        }
        const projectDir = await resolveProjectDir();
        await cleanProjectScopes(projectDir, rest);
        console.error(`Cleaned ${rest.join(", ")}`);
        return 0;
      }
      case "compact": {
        if (rest.some((arg) => isHelpToken(arg))) {
          printCompactHelp();
          return 0;
        }
        const parsed = parseCompactArgs(rest, options);
        const projectDir = parsed.projectDir || await resolveProjectDir();
        const hasYes = parsed.hasYes;
        const hasNo = parsed.hasNo;
        if (hasYes && hasNo) {
          throw new Error(
            "alteran compact cannot accept both yes and no flags",
          );
        }
        if (hasNo) {
          printCompactWarning(projectDir);
          console.error("Cancelled compact");
          return 0;
        }
        if (!hasYes) {
          const confirmation = await confirmCompact(projectDir);
          if (confirmation !== "yes") {
            console.error("Cancelled compact");
            return 0;
          }
        }
        await compactProject(projectDir);
        console.error("Compacted project");
        return 0;
      }
      case "compact-copy": {
        if (rest.length === 0 || rest.some((arg) => isHelpToken(arg))) {
          printCompactCopyHelp();
          return 0;
        }
        const parsed = parseCompactCopyArgs(rest, options);
        const sourceProjectDir = parsed.sourceProjectDir || await resolveProjectDir();
        await compactCopyProject(sourceProjectDir, parsed.destinationDir);
        console.error(`Created compact copy at ${parsed.destinationDir}`);
        return 0;
      }
      case "run": {
        const [script, ...scriptArgs] = rest;
        if (!script || isHelpToken(script)) {
          printRunHelp();
          return 0;
        }
        const projectDir = await resolveProjectDir();
        return await runScript(projectDir, script, scriptArgs);
      }
      case "task": {
        const [taskName, ...taskArgs] = rest;
        if (!taskName || isHelpToken(taskName)) {
          printTaskHelp();
          return 0;
        }
        const projectDir = await resolveProjectDir();
        return await runTask(projectDir, taskName, taskArgs);
      }
      case "test": {
        if (rest.some((arg) => isHelpToken(arg))) {
          printTestHelp();
          return 0;
        }
        const projectDir = await resolveProjectDir();
        return await passthroughDeno(projectDir, ["test", ...rest]);
      }
      case "deno": {
        if (rest.length === 0 || rest.some((arg) => isHelpToken(arg))) {
          printDenoHelp();
          return 0;
        }
        const projectDir = await resolveProjectDir();
        return await passthroughDeno(projectDir, rest);
      }
      case "x": {
        const [moduleSpecifier, ...moduleArgs] = rest;
        if (!moduleSpecifier || isHelpToken(moduleSpecifier)) {
          printXHelp();
          return 0;
        }
        const projectDir = await resolveProjectDir();
        return await runDenoX(projectDir, moduleSpecifier, moduleArgs);
      }
      case "update": {
        if (rest.some((arg) => isHelpToken(arg))) {
          printUpdateHelp();
          return 0;
        }
        const projectDir = await resolveProjectDir();
        return await passthroughDeno(projectDir, [
          "outdated",
          "--update",
          "--latest",
          ...rest,
        ]);
      }
      case "upgrade": {
        if (rest.some((arg) => isHelpToken(arg))) {
          printUpgradeHelp();
          return 0;
        }
        const projectDir = await resolveProjectDir();
        let alteran: string | true | undefined;
        let deno: string | true | undefined;
        for (const flag of rest) {
          alteran ??= parseUpgradeOption(flag, "alteran", "alt");
          deno ??= parseUpgradeOption(flag, "deno", "deno");
        }
        if (!alteran && !deno) {
          alteran = true;
        }
        return await upgradeTargets(projectDir, { alteran, deno });
      }
      case "use": {
        if (rest.some((arg) => isHelpToken(arg))) {
          printUseHelp();
          return 0;
        }
        const denoFlag = rest.find((flag) => flag.startsWith("--deno="));
        if (!denoFlag) {
          throw new Error("use requires --deno=<version>");
        }
        const projectDir = await resolveProjectDir();
        await useDenoVersion(projectDir, denoFlag.slice("--deno=".length));
        return 0;
      }
      case "help":
      case "--help":
      case "-h":
        printHelp();
        return 0;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Alteran error: ${message}`);
    return 1;
  }
}

export async function runCli(argv: string[]): Promise<number> {
  return await runCliInternal(argv);
}

if (import.meta.main) {
  Deno.exit(await runCli(Deno.args));
}
