import { basename, dirname, join, relative, resolve } from "node:path";

const IS_WINDOWS = Deno.build.os === "windows";

export async function exists(path: string): Promise<boolean> {
  try {
    await Deno.lstat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await Deno.lstat(path)).isDirectory;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

export async function ensureDir(path: string): Promise<void> {
  await Deno.mkdir(path, { recursive: true });
}

export async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    throw error;
  }
}

export async function writeTextFileIfChanged(
  path: string,
  content: string,
): Promise<void> {
  const current = await readTextIfExists(path);
  if (
    current === content ||
    (
      current !== null &&
      current.replaceAll("\r\n", "\n") === content.replaceAll("\r\n", "\n")
    )
  ) {
    return;
  }
  await ensureDir(dirname(path));
  await Deno.writeTextFile(path, content);
}

export async function removeIfExists(path: string): Promise<void> {
  if (await exists(path)) {
    await Deno.remove(path, { recursive: true });
  }
}

function batchLiteral(value: string): string {
  return `"${value.replaceAll(`"`, `""`)}"`;
}

function normalizeWindowsPathForComparison(path: string): string {
  return resolve(path).replaceAll("/", "\\").toLowerCase();
}

interface WindowsCleanupContext {
  batchPath: string;
}

let activeWindowsCleanupBatchPath: string | null = null;
let queuedDenoClean:
  | {
    args: string[];
    denoPath: string;
    env?: Record<string, string>;
  }
  | null = null;
let queuedRuntimeDir: string | null = null;

const WINDOWS_DEFERRED_DENO_CLEAN_RETRIES = 10;
const WINDOWS_DEFERRED_DENO_CLEAN_DELAY_MS = 500;
const WINDOWS_DEFERRED_RUNTIME_DELETE_RETRIES = 10;
const WINDOWS_DEFERRED_RUNTIME_DELETE_DELAY_MS = 1000;

function resolveWindowsCleanupContext(
  projectDir?: string,
): WindowsCleanupContext | null {
  if (!IS_WINDOWS) {
    return null;
  }
  const batchPath = Deno.env.get("ALTERAN_TMP_CLEANUP_BAT")?.trim();
  const wrapperProjectDir = Deno.env.get("ALTERAN_WRAPPER_PROJECT_DIR")?.trim();
  if (!batchPath || !wrapperProjectDir) {
    return null;
  }
  if (
    projectDir &&
    normalizeWindowsPathForComparison(wrapperProjectDir) !==
      normalizeWindowsPathForComparison(projectDir)
  ) {
    return null;
  }
  const resolvedBatchPath = resolve(batchPath);
  return { batchPath: resolvedBatchPath };
}

function resetWindowsCleanupStateIfNeeded(
  context: WindowsCleanupContext,
): void {
  if (activeWindowsCleanupBatchPath === context.batchPath) {
    return;
  }
  activeWindowsCleanupBatchPath = context.batchPath;
  queuedDenoClean = null;
  queuedRuntimeDir = null;
}

function renderWindowsCleanupBatch(
): string {
  const lines = [
    "@echo off",
    "setlocal EnableExtensions",
    `cd /d "%TEMP%" >nul 2>nul`,
  ];

  if (queuedDenoClean) {
    const args = queuedDenoClean.args;
    const envLines = Object.entries(queuedDenoClean.env ?? {}).map((
      [key, value],
    ) => `set "${key}=${value.replaceAll('"', '""')}"`);
    lines.push(...envLines);
    lines.push(
      `for /L %%N in (1,1,${WINDOWS_DEFERRED_DENO_CLEAN_RETRIES}) do (`,
      `  ${batchLiteral(queuedDenoClean.denoPath)} clean${
        args.length ? ` ${args.map((arg) => batchLiteral(arg)).join(" ")}` : ""
      }`,
      `  if errorlevel 1 ${
        windowsBatchSleepLine(WINDOWS_DEFERRED_DENO_CLEAN_DELAY_MS)
      }`,
      `)`,
    );
  }

  if (queuedRuntimeDir) {
    lines.push(
      `for /L %%N in (1,1,${WINDOWS_DEFERRED_RUNTIME_DELETE_RETRIES}) do (`,
      `  if exist ${batchLiteral(queuedRuntimeDir)} rmdir /s /q ${
        batchLiteral(queuedRuntimeDir)
      } >nul 2>nul`,
      `  if exist ${batchLiteral(queuedRuntimeDir)} ${
        windowsBatchSleepLine(WINDOWS_DEFERRED_RUNTIME_DELETE_DELAY_MS)
      }`,
      `)`,
    );
  }

  lines.push(
    `(goto) 2>nul & del /f /q "%~f0"`,
    "",
  );
  return lines.join("\r\n");
}

async function writeWindowsCleanupBatch(
  context: WindowsCleanupContext,
): Promise<void> {
  if (!queuedDenoClean && !queuedRuntimeDir) {
    await removeIfExists(context.batchPath);
    return;
  }
  await ensureDir(dirname(context.batchPath));
  await Deno.writeTextFile(
    context.batchPath,
    renderWindowsCleanupBatch(),
  );
}

function windowsBatchSleepLine(ms: number): string {
  return `ping 127.0.0.1 -n 1 -w ${Math.max(1, ms)} >nul`;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

export interface CurrentRuntimeDenoCleanOptions {
  projectDir?: string;
  denoPath: string;
  args?: string[];
  env?: Record<string, string>;
}

async function cleanCurrentDenoCacheWindowsImpl(
  options: CurrentRuntimeDenoCleanOptions,
): Promise<void> {
  const context = resolveWindowsCleanupContext(options.projectDir);
  if (!context) {
    await cleanCurrentDenoCacheUnixImpl(options);
    return;
  }
  resetWindowsCleanupStateIfNeeded(context);
  if (!queuedRuntimeDir) {
    queuedDenoClean = {
      args: [...(options.args ?? [])],
      denoPath: options.denoPath,
      env: options.env ? { ...options.env } : undefined,
    };
  }
  await writeWindowsCleanupBatch(context);
}

async function cleanCurrentDenoCacheUnixImpl(
  options: CurrentRuntimeDenoCleanOptions,
): Promise<void> {
  const args = options.args ?? [];
  const status = await new Deno.Command(options.denoPath, {
    args: ["clean", ...args],
    env: options.env,
    stdout: "inherit",
    stderr: "inherit",
  }).spawn().status;

  if (!status.success) {
    throw new Error(`deno clean failed with exit code ${status.code}`);
  }
}

export async function cleanCurrentDenoCache(
  options: CurrentRuntimeDenoCleanOptions,
): Promise<void> {
  if (IS_WINDOWS) {
    await cleanCurrentDenoCacheWindowsImpl(options);
    return;
  }
  await cleanCurrentDenoCacheUnixImpl(options);
}

export interface RemoveCurrentRuntimeOptions {
  projectDir?: string;
}

async function removeCurrentRuntimeWindowsImpl(
  runtimeDir: string,
  options: RemoveCurrentRuntimeOptions,
): Promise<void> {
  const context = resolveWindowsCleanupContext(options.projectDir);
  if (!context) {
    await removeCurrentRuntimeUnixImpl(runtimeDir, options);
    return;
  }
  resetWindowsCleanupStateIfNeeded(context);
  queuedRuntimeDir = runtimeDir;
  queuedDenoClean = null;
  await writeWindowsCleanupBatch(context);
}

async function removeCurrentRuntimeUnixImpl(
  runtimeDir: string,
  options: RemoveCurrentRuntimeOptions,
): Promise<void> {
  for (let attempt = 0; attempt < WINDOWS_DEFERRED_RUNTIME_DELETE_RETRIES; attempt++) {
    await removeIfExists(runtimeDir);
    if (!(await exists(runtimeDir))) {
      return;
    }
    await delay(WINDOWS_DEFERRED_RUNTIME_DELETE_DELAY_MS);
  }

  if (await exists(runtimeDir)) {
    throw new Error(`Failed to remove runtime: ${runtimeDir}`);
  }
}

export async function removeCurrentRuntime(
  runtimeDir: string,
  options: RemoveCurrentRuntimeOptions = {},
): Promise<void> {
  if (IS_WINDOWS) {
    await removeCurrentRuntimeWindowsImpl(runtimeDir, options);
    return;
  }
  await removeCurrentRuntimeUnixImpl(runtimeDir, options);
}

export function toPortablePath(path: string): string {
  return path.replaceAll("\\", "/");
}

export function toProjectRelativePath(
  projectDir: string,
  targetPath: string,
): string {
  const relativePath = toPortablePath(relative(projectDir, targetPath));
  if (!relativePath || relativePath === ".") {
    return ".";
  }
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}

export function resolveProjectPath(
  projectDir: string,
  maybeRelativePath: string,
): string {
  return resolve(projectDir, maybeRelativePath);
}

export async function copyDirectory(
  sourceDir: string,
  targetDir: string,
  options: { filter?: (absolutePath: string) => boolean } = {},
): Promise<void> {
  await ensureDir(targetDir);
  for await (const entry of Deno.readDir(sourceDir)) {
    const sourcePath = join(sourceDir, entry.name);
    if (options.filter && !options.filter(sourcePath)) {
      continue;
    }

    const targetPath = join(targetDir, entry.name);
    if (entry.isDirectory) {
      await copyDirectory(sourcePath, targetPath, options);
    } else if (entry.isFile) {
      await ensureDir(dirname(targetPath));
      await Deno.copyFile(sourcePath, targetPath);
      if (Deno.build.os !== "windows") {
        const sourceInfo = await Deno.lstat(sourcePath);
        const sourceMode = sourceInfo.mode;
        if (sourceMode !== null && (sourceMode & 0o111) !== 0) {
          await Deno.chmod(targetPath, sourceMode & 0o777);
        }
      }
    }
  }
}

export async function listDirectSubdirectories(
  path: string,
): Promise<string[]> {
  if (!(await isDirectory(path))) {
    return [];
  }

  const result: string[] = [];
  for await (const entry of Deno.readDir(path)) {
    if (entry.isDirectory) {
      result.push(entry.name);
    }
  }
  return result.sort((left, right) => left.localeCompare(right));
}

export async function listFiles(path: string): Promise<string[]> {
  if (!(await isDirectory(path))) {
    return [];
  }

  const result: string[] = [];
  for await (const entry of Deno.readDir(path)) {
    if (entry.isFile) {
      result.push(entry.name);
    }
  }
  return result.sort((left, right) => left.localeCompare(right));
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "") || basename(value).toLowerCase();
}
