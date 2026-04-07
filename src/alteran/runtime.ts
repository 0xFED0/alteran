import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDefaultAlteranConfig,
  discoverApps,
  discoverTools,
  ensureAppConfig,
  ensureProjectMarkers,
  readAlteranConfig,
  resolveRegisteredPath,
  syncAppDenoConfig,
  syncRootDenoConfig,
  updateAlteranConfig,
} from "./config.ts";
import {
  copyDirectory,
  ensureDir,
  exists,
  listDirectSubdirectories,
  readTextIfExists,
  removeIfExists,
  resolveProjectPath,
  slugify,
  toProjectRelativePath,
  writeTextFileIfChanged,
} from "./fs.ts";
import {
  appendEvent,
  captureStream,
  createManagedEnv,
  finishLogSession,
  startLogSession,
} from "./logging/events.ts";
import { detectPlatform } from "./platform.ts";
import {
  createAppScaffold,
  createStandaloneAppScaffold,
  createToolScaffold,
  ensureManagedAppScripts,
} from "./scaffold.ts";
import {
  readActivateBatTemplate,
  readActivateTemplate,
  readSetupBatTemplate,
  readSetupTemplate,
} from "./templates/bootstrap.ts";
import { renderBatchEnv, renderShellEnv } from "./templates/env.ts";
import type { AlteranConfig, RegistryEntry } from "./types.ts";
import { parseJsonc } from "./jsonc.ts";

export interface ProjectPaths {
  projectDir: string;
  runtimeDir: string;
  alteranDir: string;
  logsDir: string;
  toolsDir: string;
  libsDir: string;
  denoRootDir: string;
  platformDir: string;
  denoBinDir: string;
  denoPath: string;
  cacheDir: string;
}

export function getProjectPaths(projectDir: string): ProjectPaths {
  const platform = detectPlatform();
  const runtimeDir = join(projectDir, ".runtime");
  const denoRootDir = join(runtimeDir, "deno");
  const platformDir = join(denoRootDir, platform.id);
  const denoBinDir = join(platformDir, "bin");

  return {
    projectDir,
    runtimeDir,
    alteranDir: join(runtimeDir, "alteran"),
    logsDir: join(runtimeDir, "logs"),
    toolsDir: join(runtimeDir, "tools"),
    libsDir: join(runtimeDir, "libs"),
    denoRootDir,
    platformDir,
    denoBinDir,
    denoPath: join(denoBinDir, platform.denoBinaryName),
    cacheDir: join(platformDir, "cache"),
  };
}

export function getBundleRoot(): string {
  const bundleUrl = new URL("../../", import.meta.url);
  if (bundleUrl.protocol !== "file:") {
    throw new Error("Alteran bundle root is only available for file: modules");
  }
  return resolve(fileURLToPath(bundleUrl));
}

export function tryGetBundleRoot(): string | null {
  try {
    return getBundleRoot();
  } catch {
    return null;
  }
}

async function loadDotEnvFile(dotEnvPath: string): Promise<void> {
  const content = await readTextIfExists(dotEnvPath);
  if (content === null) {
    return;
  }

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(
      /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u,
    );
    if (!match) {
      continue;
    }

    let [, key, value] = match;
    value = value.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (Deno.env.get(key) === undefined) {
      Deno.env.set(key, value);
    }
  }
}

export async function loadProjectDotEnv(projectDir: string): Promise<void> {
  const bundleRoot = tryGetBundleRoot();
  const dotEnvPaths = [
    join(projectDir, ".env"),
    ...(bundleRoot ? [join(bundleRoot, ".env")] : []),
  ];

  for (const dotEnvPath of dotEnvPaths) {
    await loadDotEnvFile(dotEnvPath);
  }

  const configuredSource = Deno.env.get("ALTERAN_SRC");
  if (configuredSource && !isAbsolute(configuredSource)) {
    for (const dotEnvPath of dotEnvPaths) {
      const content = await readTextIfExists(dotEnvPath);
      if (content?.includes("ALTERAN_SRC")) {
        Deno.env.set(
          "ALTERAN_SRC",
          resolve(dirname(dotEnvPath), configuredSource),
        );
        break;
      }
    }
  }
}

export async function resolveAlteranSourceRoot(
  projectDir: string,
): Promise<string | null> {
  await loadProjectDotEnv(projectDir);
  const configured = Deno.env.get("ALTERAN_SRC")?.trim();
  const bundleRoot = tryGetBundleRoot();
  const candidates = [
    configured ? resolve(configured) : null,
    join(projectDir, "src"),
    ...(bundleRoot ? [join(bundleRoot, "src")] : []),
  ].filter((candidate): candidate is string => candidate !== null);

  for (const candidate of candidates) {
    if (await exists(join(candidate, "alteran", "mod.ts"))) {
      return candidate;
    }
  }

  return null;
}

const DEFAULT_DENO_SOURCES = ["https://dl.deno.land/release"];
const DEFAULT_ALTERAN_RUN_SOURCES: string[] = [];
const DEFAULT_ALTERAN_ARCHIVE_SOURCES: string[] = [];
const GITIGNORE_BEGIN = "# --- alteran managed: begin ---";
const GITIGNORE_END = "# --- alteran managed: end ---";

function getManagedProjectGitignoreBlock(): string {
  return [
    GITIGNORE_BEGIN,
    ".DS_Store",
    "Thumbs.db",
    "activate",
    "activate.bat",
    ".runtime/",
    "apps/*/app",
    "apps/*/app.bat",
    "apps/*/.runtime/",
    "dist/",
    GITIGNORE_END,
  ].join("\n");
}

function parseConfiguredSources(value: string): string[] {
  return value
    .split(/[\s;]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getConfiguredDenoSources(): string[] {
  const configured = Deno.env.get("DENO_SOURCES");
  return configured === undefined
    ? [...DEFAULT_DENO_SOURCES]
    : parseConfiguredSources(configured);
}

export function getConfiguredAlteranRunSources(): string[] {
  const configured = Deno.env.get("ALTERAN_RUN_SOURCES") ??
    Deno.env.get("ALTERAN_SOURCES");
  return configured === undefined
    ? [...DEFAULT_ALTERAN_RUN_SOURCES]
    : parseConfiguredSources(configured);
}

export function getConfiguredAlteranArchiveSources(): string[] {
  const configured = Deno.env.get("ALTERAN_ARCHIVE_SOURCES");
  return configured === undefined
    ? [...DEFAULT_ALTERAN_ARCHIVE_SOURCES]
    : parseConfiguredSources(configured);
}

function normalizeDenoVersion(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

function stripVersionPrefix(version: string): string {
  return version.replace(/^v/u, "");
}

function isExactDenoVersionSpec(versionSpec: string): boolean {
  return /^\d+\.\d+\.\d+$/u.test(stripVersionPrefix(versionSpec));
}

function compareVersions(left: string, right: string): number {
  const leftParts = stripVersionPrefix(left).split(".").map((part) =>
    Number(part)
  );
  const rightParts = stripVersionPrefix(right).split(".").map((part) =>
    Number(part)
  );
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index++) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart > rightPart) {
      return 1;
    }
    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

function versionSatisfiesRequirement(
  installedVersion: string,
  versionSpec: string,
): boolean {
  const normalizedInstalled = stripVersionPrefix(installedVersion);
  const normalizedSpec = versionSpec.trim();

  if (isExactDenoVersionSpec(normalizedSpec)) {
    return normalizedInstalled === stripVersionPrefix(normalizedSpec);
  }

  const comparatorMatch = normalizedSpec.match(
    /^(>=|<=|>|<|=)\s*(\d+\.\d+\.\d+)$/u,
  );
  if (!comparatorMatch) {
    return normalizedInstalled === stripVersionPrefix(normalizedSpec);
  }

  const [, comparator, comparatorVersion] = comparatorMatch;
  const comparison = compareVersions(normalizedInstalled, comparatorVersion);

  switch (comparator) {
    case ">":
      return comparison > 0;
    case ">=":
      return comparison >= 0;
    case "<":
      return comparison < 0;
    case "<=":
      return comparison <= 0;
    case "=":
      return comparison === 0;
    default:
      return false;
  }
}

async function readInstalledDenoVersion(
  denoPath: string,
): Promise<string | null> {
  try {
    const output = await new Deno.Command(denoPath, {
      args: ["eval", "console.log(Deno.version.deno)"],
      stdout: "piped",
      stderr: "null",
    }).output();
    if (!output.success) {
      return null;
    }
    return new TextDecoder().decode(output.stdout).trim() || null;
  } catch {
    return null;
  }
}

async function currentDenoSatisfiesRequirement(
  desiredVersion?: string,
): Promise<boolean> {
  const normalizedDesiredVersion = desiredVersion?.trim();
  if (!normalizedDesiredVersion) {
    return true;
  }

  const installedVersion = await readInstalledDenoVersion(Deno.execPath());
  return installedVersion !== null &&
    versionSatisfiesRequirement(installedVersion, normalizedDesiredVersion);
}

async function seedLocalDenoFromExecutable(
  projectDir: string,
  sourceExecutable: string,
): Promise<string> {
  const paths = getProjectPaths(projectDir);
  await ensureDir(paths.denoBinDir);
  await ensureDir(paths.cacheDir);
  await Deno.copyFile(sourceExecutable, paths.denoPath);
  const sourceCacheDir = await (async (): Promise<string | null> => {
    const explicitDenoDir = Deno.env.get("DENO_DIR")?.trim();
    if (explicitDenoDir && await exists(explicitDenoDir)) {
      return explicitDenoDir;
    }
    const siblingCacheDir = resolve(
      dirname(dirname(resolve(sourceExecutable))),
      "cache",
    );
    return await exists(siblingCacheDir) ? siblingCacheDir : null;
  })();
  if (sourceCacheDir !== null) {
    await copyDirectory(sourceCacheDir, paths.cacheDir);
  }
  if (Deno.build.os !== "windows") {
    await Deno.chmod(paths.denoPath, 0o755);
  }
  return paths.denoPath;
}

async function warmAlteranRuntimeCache(
  projectDir: string,
  denoExecutable: string,
): Promise<void> {
  const paths = getProjectPaths(projectDir);
  const output = await new Deno.Command(denoExecutable, {
    args: ["cache", join(paths.alteranDir, "mod.ts")],
    cwd: projectDir,
    env: {
      ...Deno.env.toObject(),
      DENO_DIR: paths.cacheDir,
      DENO_INSTALL_ROOT: paths.platformDir,
      ALTERAN_HOME: paths.runtimeDir,
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) {
    const stderr = new TextDecoder().decode(output.stderr).trim();
    const stdout = new TextDecoder().decode(output.stdout).trim();
    throw new Error(
      stderr || stdout || `Failed to warm Alteran runtime cache (exit ${output.code}).`,
    );
  }
}

async function resolveLatestDenoReleaseVersion(
  sources: string[],
): Promise<string> {
  const errors: string[] = [];

  for (const source of sources) {
    const normalizedSource = source.replace(/\/+$/u, "");
    const latestUrls = [`${normalizedSource}/release-latest.txt`];
    if (normalizedSource.endsWith("/release")) {
      latestUrls.push(
        `${
          normalizedSource.slice(0, -"release".length).replace(/\/+$/u, "")
        }/release-latest.txt`,
      );
    }

    for (const latestUrl of latestUrls) {
      try {
        const response = await fetch(latestUrl);
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(`HTTP ${response.status}`);
        }
        return (await response.text()).trim();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${latestUrl}: ${message}`);
      }
    }
  }

  throw new Error(
    `Failed to resolve latest Deno version from all configured sources. Check your internet connection or extend DENO_SOURCES. Attempts: ${
      errors.join(" | ")
    }`,
  );
}

async function extractZipArchive(
  archivePath: string,
  destinationDir: string,
): Promise<void> {
  const command = Deno.build.os === "windows"
    ? new Deno.Command("powershell", {
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Expand-Archive -Force -Path '${
          archivePath.replaceAll("'", "''")
        }' -DestinationPath '${destinationDir.replaceAll("'", "''")}'`,
      ],
      stdout: "null",
      stderr: "piped",
    })
    : new Deno.Command("unzip", {
      args: ["-oq", archivePath, "-d", destinationDir],
      stdout: "null",
      stderr: "piped",
    });

  const output = await command.output();
  if (!output.success) {
    const errorText = new TextDecoder().decode(output.stderr).trim();
    throw new Error(
      errorText || `archive extraction failed with code ${output.code}`,
    );
  }
}

async function downloadDenoFromSources(
  projectDir: string,
  desiredVersion?: string,
): Promise<string> {
  const sources = getConfiguredDenoSources();
  if (sources.length === 0) {
    throw new Error(
      "Cannot download Deno because DENO_SOURCES is empty. Set DENO_SOURCES before running Alteran.",
    );
  }

  const paths = getProjectPaths(projectDir);
  const platform = detectPlatform();
  const latestAvailableVersion = await resolveLatestDenoReleaseVersion(sources);
  const version = desiredVersion
    ? isExactDenoVersionSpec(desiredVersion)
      ? normalizeDenoVersion(desiredVersion)
      : normalizeDenoVersion(latestAvailableVersion)
    : normalizeDenoVersion(latestAvailableVersion);

  if (
    desiredVersion &&
    !isExactDenoVersionSpec(desiredVersion) &&
    !versionSatisfiesRequirement(version, desiredVersion)
  ) {
    throw new Error(
      `Latest available Deno version ${
        stripVersionPrefix(version)
      } does not satisfy configured spec ${desiredVersion}.`,
    );
  }
  const archiveName = `deno-${platform.archiveTarget}.zip`;
  const archivePath = join(paths.platformDir, archiveName);
  const errors: string[] = [];

  await ensureDir(paths.denoBinDir);

  for (const source of sources) {
    const archiveUrl = `${
      source.replace(/\/+$/u, "")
    }/${version}/${archiveName}`;
    try {
      const response = await fetch(archiveUrl);
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status}`);
      }

      await Deno.writeFile(
        archivePath,
        new Uint8Array(await response.arrayBuffer()),
      );
      await extractZipArchive(archivePath, paths.denoBinDir);
      await removeIfExists(archivePath);

      if (Deno.build.os !== "windows") {
        await Deno.chmod(paths.denoPath, 0o755);
      }

      return paths.denoPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${source}: ${message}`);
      await removeIfExists(archivePath);
    }
  }

  throw new Error(
    `Failed to download Deno from all configured sources. Check your internet connection or extend DENO_SOURCES. Attempts: ${
      errors.join(" | ")
    }`,
  );
}

async function* walkDirectory(rootDir: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(rootDir)) {
    const entryPath = join(rootDir, entry.name);
    if (entry.isDirectory) {
      yield* walkDirectory(entryPath);
      continue;
    }
    if (entry.isFile) {
      yield entryPath;
    }
  }
}

async function resolveArchiveAlteranEntry(
  extractDir: string,
): Promise<string | null> {
  for await (const entryPath of walkDirectory(extractDir)) {
    if (!entryPath.replaceAll("\\", "/").endsWith("/src/alteran/mod.ts")) {
      continue;
    }

    const archiveRoot = resolve(entryPath, "..", "..", "..");
    const alteranEntry = join(archiveRoot, "alteran.ts");
    if (await exists(alteranEntry)) {
      return alteranEntry;
    }
  }

  return null;
}

async function copyMaterializedRuntimeFromProject(
  sourceProjectDir: string,
  targetProjectDir: string,
): Promise<void> {
  const sourcePaths = getProjectPaths(sourceProjectDir);
  const targetPaths = getProjectPaths(targetProjectDir);

  await removeIfExists(targetPaths.alteranDir);
  await copyDirectory(sourcePaths.alteranDir, targetPaths.alteranDir);

  await removeIfExists(targetPaths.toolsDir);
  await ensureDir(targetPaths.toolsDir);
  if (await exists(sourcePaths.toolsDir)) {
    await copyDirectory(sourcePaths.toolsDir, targetPaths.toolsDir);
  }

  await removeIfExists(targetPaths.libsDir);
  await ensureDir(targetPaths.libsDir);
  if (await exists(sourcePaths.libsDir)) {
    await copyDirectory(sourcePaths.libsDir, targetPaths.libsDir);
  }
}

async function downloadAlteranRuntimeFromArchiveSources(
  projectDir: string,
): Promise<void> {
  const sources = getConfiguredAlteranArchiveSources();
  if (sources.length === 0) {
    throw new Error(
      "Cannot download Alteran because ALTERAN_ARCHIVE_SOURCES is empty. Set ALTERAN_ARCHIVE_SOURCES before running Alteran.",
    );
  }

  const errors: string[] = [];

  for (const source of sources) {
    const tempRoot = await Deno.makeTempDir({
      prefix: "alteran-archive-bootstrap-",
    });
    const archivePath = join(tempRoot, "alteran.zip");
    const extractDir = join(tempRoot, "extract");
    const tempProjectDir = join(tempRoot, "project");
    try {
      const response = await fetch(source);
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status}`);
      }

      await ensureDir(extractDir);
      await Deno.writeFile(
        archivePath,
        new Uint8Array(await response.arrayBuffer()),
      );
      await extractZipArchive(archivePath, extractDir);

      const archiveEntry = await resolveArchiveAlteranEntry(extractDir);
      if (!archiveEntry) {
        throw new Error(
          "downloaded archive did not contain alteran.ts with src/alteran/mod.ts",
        );
      }

      const output = await new Deno.Command(Deno.execPath(), {
        args: ["run", "-A", archiveEntry, "setup", tempProjectDir],
        env: Deno.env.toObject(),
        stdout: "piped",
        stderr: "piped",
      }).output();

      if (!output.success) {
        throw new Error(
          new TextDecoder().decode(output.stderr).trim() ||
            new TextDecoder().decode(output.stdout).trim() ||
            `exit code ${output.code}`,
        );
      }

      if (!(await exists(join(tempProjectDir, ".runtime", "alteran", "mod.ts")))) {
        throw new Error(
          "downloaded archive project did not contain .runtime/alteran/mod.ts",
        );
      }

      await copyMaterializedRuntimeFromProject(tempProjectDir, projectDir);
      await removeIfExists(tempRoot);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${source}: ${message}`);
      await removeIfExists(tempRoot);
    }
  }

  throw new Error(
    `Failed to download Alteran from all configured archive sources. Check your internet connection or extend ALTERAN_ARCHIVE_SOURCES. Attempts: ${
      errors.join(" | ")
    }`,
  );
}

async function downloadAlteranRuntimeFromConfiguredSources(
  projectDir: string,
): Promise<void> {
  const archiveSources = getConfiguredAlteranArchiveSources();

  if (archiveSources.length > 0) {
    await downloadAlteranRuntimeFromArchiveSources(projectDir);
    return;
  }

  const runnableSources = getConfiguredAlteranRunSources();
  if (runnableSources.length > 0) {
    throw new Error(
      "Cannot materialize Alteran runtime because ALTERAN_ARCHIVE_SOURCES is empty and no local Alteran source is available. ALTERAN_RUN_SOURCES can launch Alteran, but archive sources are required to install/materialize the project-local runtime.",
    );
  }

  throw new Error(
    "Cannot materialize Alteran runtime because ALTERAN_RUN_SOURCES and ALTERAN_ARCHIVE_SOURCES are empty and no local Alteran source is available. Set ALTERAN_ARCHIVE_SOURCES to an installable archive bundle before running Alteran bootstrap.",
  );
}

async function ensureAlteranRuntimeMaterial(
  projectDir: string,
  options: { preferRemote?: boolean; version?: string | true } = {},
): Promise<void> {
  const targetDir = join(projectDir, ".runtime", "alteran");
  const targetMod = join(targetDir, "mod.ts");
  const localSourceRoot = await resolveAlteranSourceRoot(projectDir);
  const localSourceDir = localSourceRoot
    ? join(localSourceRoot, "alteran")
    : null;
  const localSourceAvailable = localSourceDir !== null &&
    await exists(join(localSourceDir, "mod.ts")) &&
    resolve(localSourceDir) !== resolve(targetDir);

  if (options.preferRemote) {
    const remoteArchiveSources = getConfiguredAlteranArchiveSources();
    if (remoteArchiveSources.length > 0) {
      await downloadAlteranRuntimeFromConfiguredSources(projectDir);
      return;
    }
    if (localSourceAvailable) {
      await materializeAlteranSource(projectDir, localSourceRoot!);
      return;
    }
    if (await exists(targetMod)) {
      return;
    }
    throw new Error(
      "Cannot obtain Alteran runtime because no local Alteran source or installed runtime is available and ALTERAN_ARCHIVE_SOURCES is empty.",
    );
  }

  if (localSourceAvailable) {
    await materializeAlteranSource(projectDir, localSourceRoot!);
    return;
  }

  if (await exists(targetMod)) {
    return;
  }

  await downloadAlteranRuntimeFromConfiguredSources(projectDir);
}

async function materializeAlteranSource(
  projectDir: string,
  sourceRoot: string,
): Promise<void> {
  const paths = getProjectPaths(projectDir);
  await removeIfExists(paths.alteranDir);
  await copyDirectory(join(sourceRoot, "alteran"), paths.alteranDir);

  await removeIfExists(paths.toolsDir);
  await ensureDir(paths.toolsDir);
  if (await exists(join(sourceRoot, "tools"))) {
    await copyDirectory(join(sourceRoot, "tools"), paths.toolsDir);
  }

  await removeIfExists(paths.libsDir);
  await ensureDir(paths.libsDir);
  if (await exists(join(sourceRoot, "libs"))) {
    await copyDirectory(join(sourceRoot, "libs"), paths.libsDir);
  }
}

export async function ensureProjectStructure(
  projectDir: string,
): Promise<ProjectPaths> {
  const paths = getProjectPaths(projectDir);
  await ensureDir(projectDir);
  await ensureDir(join(projectDir, "apps"));
  await ensureDir(join(projectDir, "tools"));
  await ensureDir(join(projectDir, "libs"));
  await ensureDir(join(projectDir, "tests"));
  await ensureDir(paths.runtimeDir);
  await ensureDir(paths.alteranDir);
  await ensureDir(paths.logsDir);
  await ensureDir(paths.toolsDir);
  await ensureDir(paths.libsDir);
  await ensureDir(paths.denoRootDir);
  await ensureDir(paths.platformDir);
  await ensureDir(paths.denoBinDir);
  await ensureDir(paths.cacheDir);
  await ensureProjectMarkers(projectDir);
  return paths;
}

async function copyBundledRuntime(projectDir: string): Promise<void> {
  await ensureAlteranRuntimeMaterial(projectDir);
}

async function ensureBootstrapFiles(projectDir: string): Promise<void> {
  const setupTarget = join(projectDir, "setup");
  const setupBatTarget = join(projectDir, "setup.bat");
  const setupSource = await readSetupTemplate();
  const setupBatSource = await readSetupBatTemplate();

  await writeTextFileIfChanged(setupTarget, setupSource);
  if (Deno.build.os !== "windows") {
    await Deno.chmod(setupTarget, 0o755);
  }
  await writeTextFileIfChanged(setupBatTarget, setupBatSource);
}

async function ensureActivationFiles(projectDir: string): Promise<void> {
  const activateTarget = join(projectDir, "activate");
  const activateBatTarget = join(projectDir, "activate.bat");
  const paths = getProjectPaths(projectDir);
  const shellInput = {
    projectDir: projectDir.replaceAll("\\", "/"),
    denoExe: paths.denoPath.replaceAll("\\", "/"),
    alteranEntry: join(paths.alteranDir, "mod.ts").replaceAll("\\", "/"),
    denoCacheDir: paths.cacheDir.replaceAll("\\", "/"),
  };
  const batchInput = {
    projectDir: projectDir.replaceAll("/", "\\"),
    denoExe: paths.denoPath.replaceAll("/", "\\"),
    alteranEntry: join(paths.alteranDir, "mod.ts").replaceAll("/", "\\"),
    denoCacheDir: paths.cacheDir.replaceAll("/", "\\"),
  };

  await writeTextFileIfChanged(activateTarget, await readActivateTemplate(shellInput));
  if (Deno.build.os !== "windows") {
    await Deno.chmod(activateTarget, 0o755);
  }
  await writeTextFileIfChanged(
    activateBatTarget,
    await readActivateBatTemplate(batchInput),
  );
}

async function ensureProjectGitignore(projectDir: string): Promise<void> {
  const gitignorePath = join(projectDir, ".gitignore");
  const block = getManagedProjectGitignoreBlock();
  const current = await readTextIfExists(gitignorePath);

  if (current === null) {
    await writeTextFileIfChanged(gitignorePath, `${block}\n`);
    return;
  }

  if (current.includes(GITIGNORE_BEGIN) && current.includes(GITIGNORE_END)) {
    const updated = current.replace(
      new RegExp(
        `${GITIGNORE_BEGIN}[\\s\\S]*?${GITIGNORE_END}`,
        "m",
      ),
      block,
    );
    await writeTextFileIfChanged(
      gitignorePath,
      updated.endsWith("\n") ? updated : `${updated}\n`,
    );
    return;
  }

  const separator = current.endsWith("\n\n")
    ? ""
    : current.endsWith("\n")
    ? "\n"
    : "\n\n";
  await writeTextFileIfChanged(
    gitignorePath,
    `${current}${separator}${block}\n`,
  );
}

export async function ensureLocalDeno(
  projectDir: string,
  desiredVersion?: string,
): Promise<string> {
  const paths = getProjectPaths(projectDir);
  const normalizedDesiredVersion = desiredVersion?.trim();
  const currentExecutable = resolve(Deno.execPath());
  const managedExecutable = resolve(paths.denoPath);

  if (await exists(paths.denoPath)) {
    if (
      currentExecutable === managedExecutable &&
      (!normalizedDesiredVersion ||
        versionSatisfiesRequirement(Deno.version.deno, normalizedDesiredVersion))
    ) {
      return paths.denoPath;
    }

    const installedVersion = await readInstalledDenoVersion(paths.denoPath);
    if (
      !normalizedDesiredVersion ||
      (installedVersion &&
        versionSatisfiesRequirement(installedVersion, normalizedDesiredVersion))
    ) {
      return paths.denoPath;
    }
  }

  if (
    currentExecutable !== managedExecutable &&
    await currentDenoSatisfiesRequirement(normalizedDesiredVersion)
  ) {
    return await seedLocalDenoFromExecutable(projectDir, currentExecutable);
  }

  return await downloadDenoFromSources(projectDir, normalizedDesiredVersion);
}

function relativeExecutable(target: string): string {
  return target.replaceAll("\\", "/");
}

async function ensureTaskDenoWrapper(
  projectDir: string,
  denoExecutable: string,
): Promise<string> {
  const paths = getProjectPaths(projectDir);
  const wrapperDir = join(paths.runtimeDir, "task-bin");
  const preinitPath = join(paths.alteranDir, "preinit.ts");
  const unixWrapper = join(wrapperDir, "deno");
  const windowsWrapper = join(wrapperDir, "deno.bat");

  await ensureDir(wrapperDir);
  await writeTextFileIfChanged(
    unixWrapper,
    `#!/usr/bin/env sh
set -eu
REAL_DENO="${denoExecutable.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"
PREINIT="${preinitPath.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"
SUBCOMMAND=\${1:-}
if [ "$#" -gt 0 ]; then
  shift
fi
case "$SUBCOMMAND" in
  run|eval|test|bench|serve)
    exec "$REAL_DENO" "$SUBCOMMAND" --preload "$PREINIT" "$@"
    ;;
  *)
    exec "$REAL_DENO" "$SUBCOMMAND" "$@"
    ;;
esac
`,
  );
  if (Deno.build.os !== "windows") {
    await Deno.chmod(unixWrapper, 0o755);
  }
  await writeTextFileIfChanged(
    windowsWrapper,
    `@echo off
set "REAL_DENO=${denoExecutable.replaceAll("/", "\\").replaceAll('"', '""')}"
set "PREINIT=${preinitPath.replaceAll("/", "\\").replaceAll('"', '""')}"
set "SUBCOMMAND=%~1"
if not "%~1"=="" shift
if /I "%SUBCOMMAND%"=="run" goto :with_preload
if /I "%SUBCOMMAND%"=="eval" goto :with_preload
if /I "%SUBCOMMAND%"=="test" goto :with_preload
if /I "%SUBCOMMAND%"=="bench" goto :with_preload
if /I "%SUBCOMMAND%"=="serve" goto :with_preload
"%REAL_DENO%" "%SUBCOMMAND%" %*
exit /b %ERRORLEVEL%

:with_preload
"%REAL_DENO%" "%SUBCOMMAND%" --preload "%PREINIT%" %*
exit /b %ERRORLEVEL%
`,
  );

  return wrapperDir;
}

async function readRootTaskCommand(
  projectDir: string,
  taskName: string,
): Promise<string | null> {
  for (const configName of ["deno.json", "deno.jsonc"]) {
    const configPath = join(projectDir, configName);
    const source = await readTextIfExists(configPath);
    if (source === null) {
      continue;
    }
    const config = parseJsonc<{ tasks?: Record<string, unknown> }>(source, {});
    const taskValue = config.tasks?.[taskName];
    if (typeof taskValue === "string") {
      return taskValue;
    }
  }
  return null;
}

function shellQuote(value: string): string {
  return value.replaceAll("'", "'\\''");
}

function appendAlias(
  aliases: Map<string, string>,
  name: string,
  command: string,
): void {
  if (!name.trim()) {
    return;
  }
  aliases.set(name, command);
}

function createShellAliasLines(
  aliases: Map<string, string>,
): string[] {
  return [...aliases.entries()].map(([name, command]) =>
    `alias ${name}='${shellQuote(command)}'`
  );
}

function createBatchAliasLines(
  aliases: Map<string, string>,
): string[] {
  return [...aliases.entries()].map(([name, command]) =>
    `doskey ${name}=${command} $*`
  );
}

function collectAppAliasCommands(config: AlteranConfig): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const [name, entry] of Object.entries(config.apps).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    for (const aliasName of entry.shell_aliases ?? []) {
      appendAlias(aliases, aliasName, `alteran app run ${name}`);
    }
  }
  return aliases;
}

function collectToolAliasCommands(config: AlteranConfig): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const [name, entry] of Object.entries(config.tools).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    for (const aliasName of entry.shell_aliases ?? []) {
      appendAlias(aliases, aliasName, `alteran tool run ${name}`);
    }
  }
  return aliases;
}

function collectBatchAppAliasCommands(
  config: AlteranConfig,
  alteranEntry: string,
): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const [name, entry] of Object.entries(config.apps).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    for (const aliasName of entry.shell_aliases ?? []) {
      appendAlias(
        aliases,
        aliasName,
        `deno run -A "${alteranEntry}" app run ${name}`,
      );
    }
  }
  return aliases;
}

function collectBatchToolAliasCommands(
  config: AlteranConfig,
  alteranEntry: string,
): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const [name, entry] of Object.entries(config.tools).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    for (const aliasName of entry.shell_aliases ?? []) {
      appendAlias(
        aliases,
        aliasName,
        `deno run -A "${alteranEntry}" tool run ${name}`,
      );
    }
  }
  return aliases;
}

export async function generateShellEnv(projectDir: string): Promise<string> {
  const config = await readAlteranConfig(projectDir);
  const paths = getProjectPaths(projectDir);
  const appAliases = createShellAliasLines(collectAppAliasCommands(config));
  const toolAliases = createShellAliasLines(collectToolAliasCommands(config));
  const shellAliases = createShellAliasLines(
    new Map(Object.entries(config.shell_aliases)),
  );

  return renderShellEnv({
    runtimeDir: relativeExecutable(paths.runtimeDir),
    cacheDir: relativeExecutable(paths.cacheDir),
    platformDir: relativeExecutable(paths.platformDir),
    denoBinDir: relativeExecutable(paths.denoBinDir),
    alteranEntry: relativeExecutable(join(paths.alteranDir, "mod.ts")),
    appAliases,
    toolAliases,
    shellAliases,
  });
}

export async function generateBatchEnv(projectDir: string): Promise<string> {
  const config = await readAlteranConfig(projectDir);
  const paths = getProjectPaths(projectDir);
  const alteranEntry = join(paths.alteranDir, "mod.ts");
  const appAliases = createBatchAliasLines(
    collectBatchAppAliasCommands(config, alteranEntry),
  );
  const toolAliases = createBatchAliasLines(
    collectBatchToolAliasCommands(config, alteranEntry),
  );
  const shellAliases = createBatchAliasLines(
    new Map(Object.entries(config.shell_aliases)),
  );

  return renderBatchEnv({
    runtimeDir: paths.runtimeDir,
    cacheDir: paths.cacheDir,
    platformDir: paths.platformDir,
    denoBinDir: paths.denoBinDir,
    alteranEntry,
    appAliases,
    toolAliases,
    shellAliases,
  });
}

export async function ensureEnvScripts(projectDir: string): Promise<void> {
  await ensureActivationFiles(projectDir);
}

function withRegistryEntry(
  current: Record<string, RegistryEntry>,
  kind: "app" | "tool",
  name: string,
  projectDir: string,
  targetPath: string,
): Record<string, RegistryEntry> {
  const existing = current[name];
  const shellAliases = existing && "shell_aliases" in existing
    ? existing.shell_aliases
    : [`${kind}-${name}`];
  return {
    ...current,
    [name]: {
      ...existing,
      path: toProjectRelativePath(projectDir, targetPath),
      name: existing?.name ?? name,
      discovered: true,
      ...(shellAliases !== undefined ? { shell_aliases: shellAliases } : {}),
    },
  };
}

export async function refreshProject(
  projectDir: string,
): Promise<AlteranConfig> {
  await loadProjectDotEnv(projectDir);
  await ensureProjectStructure(projectDir);
  await copyBundledRuntime(projectDir);
  await ensureBootstrapFiles(projectDir);
  await ensureProjectGitignore(projectDir);

  let config = await updateAlteranConfig(projectDir, (current) => ({
    ...createDefaultAlteranConfig(projectDir),
    ...current,
    apps: current.apps ?? {},
    tools: current.tools ?? {},
  }));

  const denoExecutable = await ensureLocalDeno(projectDir, config.deno_version);

  const apps = await discoverApps(projectDir, config);
  const tools = await discoverTools(projectDir, config);

  config = await updateAlteranConfig(projectDir, (current) => ({
    ...current,
    apps,
    tools,
  }));

  await syncRootDenoConfig(projectDir, config);
  for (const appName of Object.keys(config.apps).sort()) {
    const appDir = await resolveRegisteredPath(
      projectDir,
      config.apps[appName],
      `./apps/${appName}`,
    );
    await ensureAppConfig(projectDir, appName, appDir);
    await syncAppDenoConfig(projectDir, appName, appDir);
    await ensureManagedAppScripts(projectDir, appName, appDir);
  }
  await ensureActivationFiles(projectDir);
  await warmAlteranRuntimeCache(projectDir, denoExecutable);

  return config;
}

export async function setupProject(projectDir: string): Promise<AlteranConfig> {
  return await refreshProject(projectDir);
}

export async function setupStandaloneApp(path: string): Promise<void> {
  await createStandaloneAppScaffold(path);
}

export async function resolveActiveProjectDir(): Promise<string> {
  const alteranHome = Deno.env.get("ALTERAN_HOME");
  if (alteranHome) {
    return dirname(alteranHome);
  }
  return Deno.cwd();
}

function removeFromExclude(current: string[], path: string): string[] {
  return current.filter((entry) => entry !== path);
}

export async function addApp(
  projectDir: string,
  name: string,
): Promise<AlteranConfig> {
  const appDir = join(projectDir, "apps", name);
  await createAppScaffold(projectDir, name);
  await updateAlteranConfig(projectDir, (current) => ({
    ...current,
    apps: withRegistryEntry(current.apps, "app", name, projectDir, appDir),
    auto_reimport: {
      ...current.auto_reimport,
      apps: {
        ...current.auto_reimport.apps,
        exclude: removeFromExclude(
          current.auto_reimport.apps.exclude,
          `./apps/${name}`,
        ),
      },
    },
  }));
  return await refreshProject(projectDir);
}

export async function removeApp(
  projectDir: string,
  name: string,
): Promise<AlteranConfig> {
  const config = await updateAlteranConfig(projectDir, (current) => {
    const nextApps = { ...current.apps };
    delete nextApps[name];
    const exclusion = `./apps/${name}`;
    return {
      ...current,
      apps: nextApps,
      auto_reimport: {
        ...current.auto_reimport,
        apps: {
          ...current.auto_reimport.apps,
          exclude: current.auto_reimport.apps.exclude.includes(exclusion)
            ? current.auto_reimport.apps.exclude
            : [...current.auto_reimport.apps.exclude, exclusion],
        },
      },
    };
  });
  await syncRootDenoConfig(projectDir, config);
  await ensureEnvScripts(projectDir);
  return config;
}

export async function purgeApp(
  projectDir: string,
  name: string,
): Promise<AlteranConfig> {
  await removeIfExists(join(projectDir, "apps", name));
  const config = await removeApp(projectDir, name);
  await syncRootDenoConfig(projectDir, config);
  await ensureEnvScripts(projectDir);
  return config;
}

export async function addTool(
  projectDir: string,
  name: string,
): Promise<AlteranConfig> {
  const toolPath = join(projectDir, "tools", `${name}.ts`);
  await createToolScaffold(projectDir, name);
  await updateAlteranConfig(projectDir, (current) => ({
    ...current,
    tools: withRegistryEntry(current.tools, "tool", name, projectDir, toolPath),
    auto_reimport: {
      ...current.auto_reimport,
      tools: {
        ...current.auto_reimport.tools,
        exclude: removeFromExclude(
          current.auto_reimport.tools.exclude,
          `./tools/${name}.ts`,
        ),
      },
    },
  }));
  return await refreshProject(projectDir);
}

export async function removeTool(
  projectDir: string,
  name: string,
): Promise<AlteranConfig> {
  const config = await updateAlteranConfig(projectDir, (current) => {
    const nextTools = { ...current.tools };
    delete nextTools[name];
    const exclusion = `./tools/${name}.ts`;
    return {
      ...current,
      tools: nextTools,
      auto_reimport: {
        ...current.auto_reimport,
        tools: {
          ...current.auto_reimport.tools,
          exclude: current.auto_reimport.tools.exclude.includes(exclusion)
            ? current.auto_reimport.tools.exclude
            : [...current.auto_reimport.tools.exclude, exclusion],
        },
      },
    };
  });
  await syncRootDenoConfig(projectDir, config);
  await ensureEnvScripts(projectDir);
  return config;
}

export async function purgeTool(
  projectDir: string,
  name: string,
): Promise<AlteranConfig> {
  await removeIfExists(join(projectDir, "tools", `${name}.ts`));
  await removeIfExists(join(projectDir, "tools", name));
  const config = await removeTool(projectDir, name);
  await syncRootDenoConfig(projectDir, config);
  await ensureEnvScripts(projectDir);
  return config;
}

export async function listRegistry(
  projectDir: string,
  type: "apps" | "tools",
): Promise<string[]> {
  const config = await readAlteranConfig(projectDir);
  return Object.entries(type === "apps" ? config.apps : config.tools)
    .map(([name, entry]) => `${name}\t${entry.path}`)
    .sort((left, right) => left.localeCompare(right));
}

export async function reimportCategory(
  projectDir: string,
  type: "apps" | "tools",
  sourceDir: string,
): Promise<AlteranConfig> {
  const resolvedSourceDir = resolveProjectPath(projectDir, sourceDir);
  if (type === "apps") {
    for (const name of await listDirectSubdirectories(resolvedSourceDir)) {
      await updateAlteranConfig(projectDir, (current) => ({
        ...current,
        apps: withRegistryEntry(
          current.apps,
          "app",
          name,
          projectDir,
          join(resolvedSourceDir, name),
        ),
      }));
    }
  } else {
    for await (const entry of Deno.readDir(resolvedSourceDir)) {
      if (entry.isFile && entry.name.endsWith(".ts")) {
        const name = entry.name.slice(0, -3);
        await updateAlteranConfig(projectDir, (current) => ({
          ...current,
          tools: withRegistryEntry(
            current.tools,
            "tool",
            name,
            projectDir,
            join(resolvedSourceDir, entry.name),
          ),
        }));
      }
    }
  }
  return await refreshProject(projectDir);
}

export async function cleanProject(
  projectDir: string,
  scope: string,
): Promise<void> {
  const paths = getProjectPaths(projectDir);

  switch (scope) {
    case "cache":
      await removeIfExists(paths.cacheDir);
      await ensureDir(paths.cacheDir);
      break;
    case "runtime":
      await removeIfExists(paths.logsDir);
      await cleanDenoRuntime(projectDir);
      await removeUnexpectedRuntimeEntries(projectDir);
      await ensureProjectStructure(projectDir);
      break;
    case "env":
      await removeIfExists(join(projectDir, "activate"));
      await removeIfExists(join(projectDir, "activate.bat"));
      break;
    case "app-runtimes":
      for (
        const appName of await listDirectSubdirectories(
          join(projectDir, "apps"),
        )
      ) {
        await removeIfExists(join(projectDir, "apps", appName, ".runtime"));
      }
      break;
    case "logs":
      await removeIfExists(paths.logsDir);
      await ensureDir(paths.logsDir);
      break;
    case "builds":
      await removeIfExists(join(projectDir, "dist"));
      break;
    case "all":
      await cleanProject(projectDir, "runtime");
      await cleanProject(projectDir, "env");
      await cleanProject(projectDir, "app-runtimes");
      await cleanProject(projectDir, "builds");
      break;
    default:
      throw new Error(`Unknown clean scope: ${scope}`);
  }
}

export async function cleanDenoRuntime(
  projectDir: string,
  activeDenoPath = resolve(Deno.execPath()),
): Promise<void> {
  const paths = getProjectPaths(projectDir);
  const currentDenoPath = resolve(activeDenoPath);
  const currentPlatformRoot = resolve(paths.platformDir);
  const currentPlatformRelative = relative(currentPlatformRoot, currentDenoPath);
  const isCurrentManagedDeno = currentPlatformRelative !== "" &&
    !currentPlatformRelative.startsWith("..") &&
    !isAbsolute(currentPlatformRelative);

  if (!isCurrentManagedDeno) {
    await removeIfExists(paths.denoRootDir);
    return;
  }

  if (await exists(paths.denoRootDir)) {
    for await (const entry of Deno.readDir(paths.denoRootDir)) {
      if (entry.name !== detectPlatform().id) {
        await removeIfExists(join(paths.denoRootDir, entry.name));
      }
    }
  }

  if (await exists(paths.platformDir)) {
    for await (const entry of Deno.readDir(paths.platformDir)) {
      if (entry.name === "bin") {
        continue;
      }
      await removeIfExists(join(paths.platformDir, entry.name));
    }
  }

  if (await exists(paths.denoBinDir)) {
    for await (const entry of Deno.readDir(paths.denoBinDir)) {
      if (resolve(join(paths.denoBinDir, entry.name)) === currentDenoPath) {
        continue;
      }
      await removeIfExists(join(paths.denoBinDir, entry.name));
    }
  }

  await ensureDir(paths.cacheDir);
}

async function removeUnexpectedRuntimeEntries(
  projectDir: string,
): Promise<void> {
  const runtimeDir = join(projectDir, ".runtime");
  const allowedEntries = new Set([
    "alteran",
    "deno",
    "libs",
    "logs",
    "tools",
  ]);

  if (!(await exists(runtimeDir))) {
    return;
  }

  for await (const entry of Deno.readDir(runtimeDir)) {
    if (!allowedEntries.has(entry.name)) {
      await removeIfExists(join(runtimeDir, entry.name));
    }
  }
}

export async function cleanProjectScopes(
  projectDir: string,
  scopes: string[],
): Promise<void> {
  for (const scope of scopes) {
    await cleanProject(projectDir, scope);
  }
}

export async function compactProject(projectDir: string): Promise<void> {
  await cleanProjectScopes(projectDir, ["all", "app-runtimes", "builds"]);

  await removeIfExists(join(projectDir, ".runtime"));
  await removeIfExists(join(projectDir, "dist"));
  await removeIfExists(join(projectDir, "activate"));
  await removeIfExists(join(projectDir, "activate.bat"));

  const appsDir = join(projectDir, "apps");
  if (await exists(appsDir)) {
    for (const appName of await listDirectSubdirectories(appsDir)) {
      await removeIfExists(join(appsDir, appName, ".runtime"));
    }
  }
}

async function resolveDenoExecutable(
  projectDir: string,
  config?: AlteranConfig,
): Promise<string> {
  return await ensureLocalDeno(projectDir, config?.deno_version);
}

async function maybeAutoRefresh(projectDir: string): Promise<void> {
  const config = await readAlteranConfig(projectDir);
  if (config.auto_refresh_before_run) {
    await refreshProject(projectDir);
  }
}

export async function runManagedDeno(
  projectDir: string,
  type: "app" | "tool" | "task" | "run" | "test",
  name: string,
  args: string[],
  options: { cwd?: string } = {},
): Promise<number> {
  await loadProjectDotEnv(projectDir);
  const config = await readAlteranConfig(projectDir);
  const session = await startLogSession(projectDir, config, type, name, args);
  const denoExecutable = await resolveDenoExecutable(projectDir, config);
  const command = new Deno.Command(denoExecutable, {
    args,
    cwd: options.cwd ?? projectDir,
    env: createManagedEnv(projectDir, session),
    stdout: "piped",
    stderr: "piped",
  });

  const child = command.spawn();
  await appendEvent(session, {
    level: "info",
    msg: "process spawned",
    category: ["alteran", type, name],
    source: "alteran",
    event_type: "process_started",
    argv: args,
  });

  const stdoutPromise = captureStream(
    child.stdout,
    config.logging.stdout.capture === false
      ? []
      : [session.stdoutPath, session.customStdoutPath],
    config.logging.stdout.mirror === false ? "none" : "stdout",
  );
  const stderrPromise = captureStream(
    child.stderr,
    config.logging.stderr.capture === false
      ? []
      : [session.stderrPath, session.customStderrPath],
    config.logging.stderr.mirror === false ? "none" : "stderr",
  );

  const status = await child.status;
  await Promise.all([stdoutPromise, stderrPromise]);
  await finishLogSession(session, status.code);
  return status.code;
}

export async function runApp(
  projectDir: string,
  name: string,
  args: string[],
): Promise<number> {
  await maybeAutoRefresh(projectDir);
  const config = await readAlteranConfig(projectDir);
  const appEntry = config.apps[name];
  const appDir = await resolveRegisteredPath(
    projectDir,
    appEntry,
    `./apps/${name}`,
  );
  return await runManagedDeno(projectDir, "app", name, [
    "task",
    "--config",
    join(appDir, "deno.json"),
    "app",
    ...args,
  ], { cwd: appDir });
}

export async function runTool(
  projectDir: string,
  name: string,
  args: string[],
): Promise<number> {
  await maybeAutoRefresh(projectDir);
  const config = await readAlteranConfig(projectDir);
  const toolEntry = config.tools[name];
  const entryPath = await resolveRegisteredPath(
    projectDir,
    toolEntry,
    `./tools/${name}.ts`,
  );
  return await runManagedDeno(projectDir, "tool", name, [
    "run",
    "-A",
    "--preload",
    join(projectDir, ".runtime", "alteran", "preinit.ts"),
    entryPath,
    ...args,
  ]);
}

export async function runTask(
  projectDir: string,
  name: string,
  args: string[],
): Promise<number> {
  await maybeAutoRefresh(projectDir);
  await loadProjectDotEnv(projectDir);
  const config = await readAlteranConfig(projectDir);
  const session = await startLogSession(projectDir, config, "task", name, [
    "task",
    name,
    ...args,
  ]);
  const denoExecutable = await resolveDenoExecutable(projectDir, config);
  const wrapperDir = await ensureTaskDenoWrapper(projectDir, denoExecutable);
  const baseEnv = createManagedEnv(projectDir, session);
  const env = {
    ...baseEnv,
    PATH: `${wrapperDir}${detectPlatform().pathSeparator}${baseEnv.PATH}`,
  };
  const taskCommand = await readRootTaskCommand(projectDir, name);
  const command = taskCommand === null
    ? new Deno.Command(denoExecutable, {
      args: ["task", name, ...args],
      cwd: projectDir,
      env,
      stdout: "piped",
      stderr: "piped",
    })
    : Deno.build.os === "windows"
    ? new Deno.Command("cmd", {
      args: ["/d", "/c", taskCommand, ...args],
      cwd: projectDir,
      env,
      stdout: "piped",
      stderr: "piped",
    })
    : new Deno.Command("sh", {
      args: ["-c", `${taskCommand} "$@"`, "alteran-task", ...args],
      cwd: projectDir,
      env,
      stdout: "piped",
      stderr: "piped",
    });

  const child = command.spawn();
  await appendEvent(session, {
    level: "info",
    msg: "process spawned",
    category: ["alteran", "task", name],
    source: "alteran",
    event_type: "process_started",
    argv: ["task", name, ...args],
  });

  const stdoutPromise = captureStream(
    child.stdout,
    config.logging.stdout.capture === false
      ? []
      : [session.stdoutPath, session.customStdoutPath],
    config.logging.stdout.mirror === false ? "none" : "stdout",
  );
  const stderrPromise = captureStream(
    child.stderr,
    config.logging.stderr.capture === false
      ? []
      : [session.stderrPath, session.customStderrPath],
    config.logging.stderr.mirror === false ? "none" : "stderr",
  );

  const status = await child.status;
  await Promise.all([stdoutPromise, stderrPromise]);
  await finishLogSession(session, status.code);
  return status.code;
}

export async function runScript(
  projectDir: string,
  script: string,
  args: string[],
): Promise<number> {
  await maybeAutoRefresh(projectDir);
  return await runManagedDeno(projectDir, "run", basename(script), [
    "run",
    "-A",
    "--preload",
    join(projectDir, ".runtime", "alteran", "preinit.ts"),
    script,
    ...args,
  ]);
}

export async function passthroughDeno(
  projectDir: string,
  args: string[],
): Promise<number> {
  if (args[0] === "test") {
    const testTarget = args.slice(1).find((arg) => !arg.startsWith("-"));
    return await runManagedDeno(
      projectDir,
      "test",
      testTarget ? basename(testTarget) : "deno-test",
      args,
    );
  }

  return await runManagedDeno(projectDir, "run", "deno", args);
}

export async function runDenoX(
  projectDir: string,
  moduleSpecifier: string,
  args: string[],
): Promise<number> {
  return await runManagedDeno(projectDir, "run", slugify(moduleSpecifier), [
    "run",
    "-A",
    moduleSpecifier,
    ...args,
  ]);
}

export async function useDenoVersion(
  projectDir: string,
  version: string,
): Promise<AlteranConfig> {
  await updateAlteranConfig(projectDir, (current) => ({
    ...current,
    deno_version: version,
  }));
  return await refreshProject(projectDir);
}

export async function upgradeTargets(
  projectDir: string,
  options: { alteran?: string | true; deno?: string | true },
): Promise<number> {
  if (options.alteran) {
    await ensureAlteranRuntimeMaterial(projectDir, {
      preferRemote: true,
      version: options.alteran,
    });
    await ensureBootstrapFiles(projectDir);
    await ensureActivationFiles(projectDir);
  }

  if (options.deno) {
    await downloadDenoFromSources(
      projectDir,
      typeof options.deno === "string" ? options.deno : undefined,
    );
    return 0;
  }

  return 0;
}
