import { basename, dirname, join, relative, resolve } from "node:path";

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
  if (current === content) {
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
