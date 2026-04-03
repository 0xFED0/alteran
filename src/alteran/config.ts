import { extname, join, relative, resolve } from "node:path";

import {
  ensureDir,
  exists,
  isDirectory,
  listDirectSubdirectories,
  listFiles,
  resolveProjectPath,
  toPortablePath,
  toProjectRelativePath,
  writeTextFileIfChanged,
} from "./fs.ts";
import { updateJsoncFile } from "./jsonc.ts";
import type {
  AlteranConfig,
  AppConfig,
  RegistryEntry,
  RootDenoConfig,
} from "./types.ts";

export function createDefaultAlteranConfig(projectDir: string): AlteranConfig {
  return {
    name: projectDir.split(/[\\/]/).at(-1) ?? "alteran-project",
    auto_refresh_before_run: false,
    deno_version: Deno.version.deno,
    logging: {
      stdout: { mirror: true, capture: true },
      stderr: { mirror: true, capture: true },
      logtape: false,
    },
    apps: {},
    tools: {},
    auto_reimport: {
      apps: { include: ["./apps/*"], exclude: [] },
      tools: { include: ["./tools/*"], exclude: [] },
    },
  };
}

export async function readAlteranConfig(
  projectDir: string,
): Promise<AlteranConfig> {
  const defaultConfig = createDefaultAlteranConfig(projectDir);
  return await updateJsoncFile(
    join(projectDir, "alteran.json"),
    defaultConfig,
    (current) => ({
      ...defaultConfig,
      ...current,
      logging: {
        ...defaultConfig.logging,
        ...current.logging,
      },
      auto_reimport: {
        apps: {
          ...defaultConfig.auto_reimport.apps,
          ...current.auto_reimport?.apps,
        },
        tools: {
          ...defaultConfig.auto_reimport.tools,
          ...current.auto_reimport?.tools,
        },
      },
      apps: current.apps ?? {},
      tools: current.tools ?? {},
    }),
  );
}

export async function updateAlteranConfig(
  projectDir: string,
  updater: (current: AlteranConfig) => AlteranConfig,
): Promise<AlteranConfig> {
  return await updateJsoncFile(
    join(projectDir, "alteran.json"),
    createDefaultAlteranConfig(projectDir),
    updater,
  );
}

function isExcluded(path: string, excludePatterns: string[]): boolean {
  return excludePatterns.some((pattern) => {
    const normalized = toPortablePath(pattern);
    if (normalized.endsWith("/*")) {
      return path.startsWith(normalized.slice(0, -2));
    }
    return path === normalized;
  });
}

function registryEntry(
  name: string,
  absolutePath: string,
  projectDir: string,
): RegistryEntry {
  return {
    name,
    path: toProjectRelativePath(projectDir, absolutePath),
    discovered: true,
  };
}

export async function discoverApps(
  projectDir: string,
  config: AlteranConfig,
): Promise<Record<string, RegistryEntry>> {
  const result: Record<string, RegistryEntry> = {};

  for (const [name, entry] of Object.entries(config.apps)) {
    if (await isDirectory(resolveProjectPath(projectDir, entry.path))) {
      result[name] = entry;
    }
  }

  const appsRoot = join(projectDir, "apps");
  for (const name of await listDirectSubdirectories(appsRoot)) {
    const appDir = join(appsRoot, name);
    const relativePath = toProjectRelativePath(projectDir, appDir);
    if (isExcluded(relativePath, config.auto_reimport.apps.exclude)) {
      continue;
    }
    result[name] = registryEntry(name, appDir, projectDir);
  }

  return result;
}

export async function discoverTools(
  projectDir: string,
  config: AlteranConfig,
): Promise<Record<string, RegistryEntry>> {
  const result: Record<string, RegistryEntry> = {};

  for (const [name, entry] of Object.entries(config.tools)) {
    if (await exists(resolveProjectPath(projectDir, entry.path))) {
      result[name] = entry;
    }
  }

  const toolsRoot = join(projectDir, "tools");
  if (!(await isDirectory(toolsRoot))) {
    return result;
  }

  for (const fileName of await listFiles(toolsRoot)) {
    if (extname(fileName) !== ".ts") {
      continue;
    }
    const name = fileName.slice(0, -3);
    const toolPath = join(toolsRoot, fileName);
    const relativePath = toProjectRelativePath(projectDir, toolPath);
    if (isExcluded(relativePath, config.auto_reimport.tools.exclude)) {
      continue;
    }
    result[name] = registryEntry(name, toolPath, projectDir);
  }

  for (const name of await listDirectSubdirectories(toolsRoot)) {
    const entryPath = join(toolsRoot, `${name}.ts`);
    const fallbackPath = join(toolsRoot, name, "mod.ts");
    if (await exists(entryPath) || !(await exists(fallbackPath))) {
      continue;
    }
    const relativePath = toProjectRelativePath(projectDir, fallbackPath);
    if (isExcluded(relativePath, config.auto_reimport.tools.exclude)) {
      continue;
    }
    result[name] = registryEntry(name, fallbackPath, projectDir);
  }

  return result;
}

async function discoverLibAliasesFromDir(
  projectDir: string,
  targetDir: string,
): Promise<Record<string, string>> {
  const aliases: Record<string, string> = {};
  if (!(await isDirectory(targetDir))) {
    return aliases;
  }

  for await (const entry of Deno.readDir(targetDir)) {
    if (entry.isFile && entry.name.endsWith(".ts")) {
      const name = entry.name.slice(0, -3);
      aliases[`@libs/${name}`] = `./${
        toPortablePath(relative(projectDir, join(targetDir, entry.name)))
      }`;
    }

    if (entry.isDirectory) {
      const modPath = join(targetDir, entry.name, "mod.ts");
      if (await exists(modPath)) {
        aliases[`@libs/${entry.name}`] = `./${
          toPortablePath(relative(projectDir, modPath))
        }`;
      }
    }
  }

  return aliases;
}

export async function syncRootDenoConfig(
  projectDir: string,
  config: AlteranConfig,
): Promise<RootDenoConfig> {
  const authoredAlteranRoot =
    await exists(join(projectDir, "src", "alteran", "mod.ts"))
      ? "./src/alteran"
      : "./.runtime/alteran";
  const rootImports = await discoverLibAliasesFromDir(
    projectDir,
    join(projectDir, "libs"),
  );
  const workspaceEntries = Object.values(config.apps)
    .map((entry) => entry.path)
    .sort((left, right) => left.localeCompare(right));

  const tasks: Record<string, string> = {
    alteran: "deno run -A ./alteran.ts",
    refresh: "deno run -A ./alteran.ts refresh",
    test: "deno test -A",
  };

  for (const name of Object.keys(config.apps).sort()) {
    tasks[`app:${name}`] = `deno run -A ./alteran.ts app run ${name}`;
  }
  for (const name of Object.keys(config.tools).sort()) {
    tasks[`tool:${name}`] = `deno run -A ./alteran.ts tool run ${name}`;
  }

  const fallback: RootDenoConfig = {
    tasks,
    imports: {},
    workspace: [],
  };

  return await updateJsoncFile(
    join(projectDir, "deno.json"),
    fallback,
    (current): RootDenoConfig => {
      const preservedTasks = Object.fromEntries(
        Object.entries(current.tasks ?? {}).filter(([key]) =>
          !["alteran", "refresh", "test"].includes(key) &&
          !key.startsWith("app:") &&
          !key.startsWith("tool:")
        ),
      );
      const preservedImports = Object.fromEntries(
        Object.entries(current.imports ?? {}).filter(([key]) =>
          key !== "@alteran" &&
          key !== "@alteran/" &&
          key !== "@alteran/logging/logtape_ext" &&
          key !== "@logtape/logtape" &&
          !key.startsWith("@libs/")
        ),
      );

      return {
        ...current,
        tasks: {
          ...preservedTasks,
          ...tasks,
        },
        imports: {
          ...preservedImports,
          "@alteran": `${authoredAlteranRoot}/mod.ts`,
          "@alteran/": `${authoredAlteranRoot}/`,
          "@alteran/logging/logtape_ext":
            `${authoredAlteranRoot}/logging/logtape_ext.ts`,
          "@logtape/logtape":
            `${authoredAlteranRoot}/logging/logtape_cfg_mock.ts`,
          ...rootImports,
        },
        workspace: workspaceEntries,
      };
    },
  );
}

export function createDefaultAppConfig(name: string): AppConfig {
  return {
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
  };
}

export async function syncAppDenoConfig(
  projectDir: string,
  appName: string,
  appDirOverride?: string,
): Promise<void> {
  const appDir = appDirOverride ?? join(projectDir, "apps", appName);
  const appLibImports = await discoverLibAliasesFromDir(
    projectDir,
    join(appDir, "libs"),
  );
  const rootLibImports = await discoverLibAliasesFromDir(
    projectDir,
    join(projectDir, "libs"),
  );
  const mergedImports = { ...rootLibImports, ...appLibImports };

  await updateJsoncFile(
    join(appDir, "deno.json"),
    { tasks: {}, imports: {} },
    (current) => ({
      ...current,
      tasks: {
        ...Object.fromEntries(
          Object.entries(current.tasks ?? {}).filter(([key]) =>
            !["core", "view", "app"].includes(key)
          ),
        ),
        core: "deno run -A ./core/mod.ts",
        view: "deno eval \"console.log('Alteran view placeholder')\"",
        app: "deno task core",
      },
      imports: {
        ...Object.fromEntries(
          Object.entries(current.imports ?? {}).filter(([key]) =>
            !key.startsWith("@libs/")
          ),
        ),
        ...Object.fromEntries(
          Object.entries(mergedImports).map(([key, value]) => {
            const relativeValue = toPortablePath(
              relative(appDir, resolve(projectDir, value)),
            );
            return [
              key,
              relativeValue.startsWith(".")
                ? relativeValue
                : `./${relativeValue}`,
            ];
          }),
        ),
      },
    }),
  );
}

export async function ensureAppConfig(
  projectDir: string,
  appName: string,
  appDirOverride?: string,
): Promise<void> {
  const appDir = appDirOverride ?? join(projectDir, "apps", appName);
  await ensureDir(appDir);
  await updateJsoncFile(
    join(appDir, "app.json"),
    createDefaultAppConfig(appName),
    (current) => ({ ...createDefaultAppConfig(appName), ...current }),
  );
}

export async function ensureProjectMarkers(projectDir: string): Promise<void> {
  await writeTextFileIfChanged(join(projectDir, "libs", ".keep"), "");
  await writeTextFileIfChanged(join(projectDir, "tests", ".keep"), "");
}

export async function resolveRegisteredPath(
  projectDir: string,
  entry: RegistryEntry | undefined,
  fallbackPath: string,
): Promise<string> {
  if (!entry) {
    return resolveProjectPath(projectDir, fallbackPath);
  }
  return resolveProjectPath(projectDir, entry.path);
}
