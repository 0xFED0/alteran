import { resolve } from "node:path";

import {
  addApp,
  addTool,
  cleanProject,
  cleanProjectScopes,
  compactProject,
  ensureProjectEnv,
  generateShellEnv,
  initProject,
  initStandaloneApp,
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
  runDenoX,
  runScript,
  runTask,
  runTool,
  upgradeTargets,
  useDenoVersion,
} from "./runtime.ts";

export {
  addApp,
  addTool,
  cleanProject,
  compactProject,
  ensureProjectEnv,
  generateShellEnv,
  initProject,
  passthroughDeno,
  refreshProject,
  resolveActiveProjectDir,
  runApp,
  runScript,
  runTask,
  runTool,
  useDenoVersion,
};

function printHelp(): void {
  console.log(`Alteran

Commands:
  alteran init [dir]
  alteran ensure-env [dir]
  alteran refresh
  alteran shellenv [dir]
  alteran app add|rm|purge|ls|run|init <name>
  alteran tool add|rm|purge|ls|run <name>
  alteran reimport apps|tools <dir>
  alteran clean <scope> [<scope> ...]
  alteran compact
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
  alteran app init <path>

Commands:
  add     Register an app and scaffold it if missing.
  rm      Remove an app from Alteran registry only.
  purge   Remove app files and unregister the app.
  ls      List registered apps.
  run     Run the app task from apps/<name>/deno.json.
  init    Create a standalone app scaffold outside the main repo.

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
  env           Remove generated env scripts
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
  alteran compact [-y|--yes|-f|--force]
  alteran compact [-n|--no]

Behavior:
  - runs safe cleanup equivalent to clean all
  - removes the root .runtime/ directory completely
  - removes nested apps/*/.runtime/ directories
  - removes dist/ output completely
  - preserves user source files, configs, and activate scripts
  - asks for confirmation before making destructive changes unless -y/-f is set
  - cancels immediately when -n is set

After compact, the project should be re-hydratable from scratch through:
  . ./activate
  activate.bat`);
}

function printCompactWarning(projectDir: string): void {
  console.error(
    `Alteran compact will reduce this project to a bootstrap-ready state:
  ${projectDir}

It will remove:
  - .runtime/
  - apps/*/.runtime/
  - dist/

It will keep:
  - activate / activate.bat
  - alteran.json / deno.json / deno.lock
  - .env / .gitignore
  - apps/ tools/ libs/ tests/
  - user-authored source and config files

The project should still be re-hydratable later through activate.`,
  );
}

function isYesFlag(value: string): boolean {
  return value === "-y" || value === "--yes" || value === "-f" ||
    value === "--force";
}

function isNoFlag(value: string): boolean {
  return value === "-n" || value === "--no";
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

export async function runCli(argv: string[]): Promise<number> {
  try {
    if (argv.length === 0) {
      printHelp();
      return 0;
    }

    const [command, ...rest] = argv;

    switch (command) {
      case "init": {
        if (isHelpToken(rest[0])) {
          console.log("Usage:\n  alteran init [dir]");
          return 0;
        }
        const targetDir = rest[0] ? resolve(Deno.cwd(), rest[0]) : Deno.cwd();
        await initProject(targetDir);
        console.error(`Initialized Alteran project at ${targetDir}`);
        return 0;
      }
      case "ensure-env": {
        if (isHelpToken(rest[0])) {
          console.log("Usage:\n  alteran ensure-env [dir]");
          return 0;
        }
        const targetDir = rest[0] ? resolve(Deno.cwd(), rest[0]) : Deno.cwd();
        const result = await ensureProjectEnv(targetDir);
        if (result.initialized) {
          console.error(`Initialized Alteran project at ${targetDir}`);
        }
        return 0;
      }
      case "refresh": {
        if (isHelpToken(rest[0])) {
          console.log("Usage:\n  alteran refresh");
          return 0;
        }
        const projectDir = await resolveActiveProjectDir();
        await refreshProject(projectDir);
        console.error(`Refreshed ${projectDir}`);
        return 0;
      }
      case "shellenv": {
        if (isHelpToken(rest[0])) {
          console.log("Usage:\n  alteran shellenv [dir]");
          return 0;
        }
        const targetDir = rest[0] ? resolve(Deno.cwd(), rest[0]) : Deno.cwd();
        const output = await generateShellEnv(targetDir);
        await Deno.stdout.write(new TextEncoder().encode(output));
        return 0;
      }
      case "app": {
        const [action, name, ...actionArgs] = rest;
        if (!action || isHelpToken(action) || isHelpToken(name)) {
          printAppHelp();
          return 0;
        }
        const projectDir = await resolveActiveProjectDir();
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
          case "init":
            if (!name) {
              throw new Error("app init requires a target path");
            }
            await initStandaloneApp(name);
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
        const projectDir = await resolveActiveProjectDir();
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
        const projectDir = await resolveActiveProjectDir();
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
        const projectDir = await resolveActiveProjectDir();
        await cleanProjectScopes(projectDir, rest);
        console.error(`Cleaned ${rest.join(", ")}`);
        return 0;
      }
      case "compact": {
        if (rest.some((arg) => isHelpToken(arg))) {
          printCompactHelp();
          return 0;
        }
        const projectDir = await resolveActiveProjectDir();
        const hasYes = rest.some(isYesFlag);
        const hasNo = rest.some(isNoFlag);
        const unsupportedArgs = rest.filter((arg) =>
          !isYesFlag(arg) && !isNoFlag(arg)
        );
        if (unsupportedArgs.length > 0) {
          throw new Error(
            `alteran compact does not accept arguments: ${
              unsupportedArgs.join(", ")
            }`,
          );
        }
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
      case "run": {
        const [script, ...scriptArgs] = rest;
        if (!script || isHelpToken(script)) {
          printRunHelp();
          return 0;
        }
        const projectDir = await resolveActiveProjectDir();
        return await runScript(projectDir, script, scriptArgs);
      }
      case "task": {
        const [taskName, ...taskArgs] = rest;
        if (!taskName || isHelpToken(taskName)) {
          printTaskHelp();
          return 0;
        }
        const projectDir = await resolveActiveProjectDir();
        return await runTask(projectDir, taskName, taskArgs);
      }
      case "test": {
        if (rest.some((arg) => isHelpToken(arg))) {
          printTestHelp();
          return 0;
        }
        const projectDir = await resolveActiveProjectDir();
        return await passthroughDeno(projectDir, ["test", ...rest]);
      }
      case "deno": {
        if (rest.length === 0 || rest.some((arg) => isHelpToken(arg))) {
          printDenoHelp();
          return 0;
        }
        const projectDir = await resolveActiveProjectDir();
        return await passthroughDeno(projectDir, rest);
      }
      case "x": {
        const [moduleSpecifier, ...moduleArgs] = rest;
        if (!moduleSpecifier || isHelpToken(moduleSpecifier)) {
          printXHelp();
          return 0;
        }
        const projectDir = await resolveActiveProjectDir();
        return await runDenoX(projectDir, moduleSpecifier, moduleArgs);
      }
      case "update": {
        if (rest.some((arg) => isHelpToken(arg))) {
          printUpdateHelp();
          return 0;
        }
        const projectDir = await resolveActiveProjectDir();
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
        const projectDir = await resolveActiveProjectDir();
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
        const projectDir = await resolveActiveProjectDir();
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

if (import.meta.main) {
  Deno.exit(await runCli(Deno.args));
}
