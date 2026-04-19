type DenoCliRuntime = {
  args: string[];
  exit(code?: number): never;
};

export type CliRunner = (args: string[]) => Promise<number>;

export function getDenoRuntime(): DenoCliRuntime | null {
  const value = (globalThis as Record<string, unknown>).Deno;
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as DenoCliRuntime;
}

export function isDeno(): boolean {
  return getDenoRuntime() !== null;
}

export async function isMain(
  entryUrl: string,
  denoImportMetaMain: boolean,
): Promise<boolean> {
  if (isDeno()) {
    return denoImportMetaMain;
  }

  const processValue = (globalThis as Record<string, unknown>).process;
  if (!processValue || typeof processValue !== "object") {
    return false;
  }
  const argv = (processValue as { argv?: unknown }).argv;
  if (!Array.isArray(argv) || typeof argv[1] !== "string") {
    return false;
  }

  const [{ resolve }, { fileURLToPath }] = await Promise.all([
    import("node:path"),
    import("node:url"),
  ]);
  return resolve(argv[1]) === resolve(fileURLToPath(entryUrl));
}

export function getCliArgs(): string[] {
  return getDenoRuntime()?.args ?? [];
}

export function exitCli(code: number): never {
  const denoRuntime = getDenoRuntime();
  if (denoRuntime) {
    denoRuntime.exit(code);
  }

  throw new Error("Unsupported runtime: Alteran requires Deno.");
}

export async function loadCliRunner(): Promise<CliRunner> {
  if (!isDeno()) {
    return async () => {
      console.error(
        "Alteran error: Only the Deno runtime is supported. Run alteran with Deno.",
      );
      return 1;
    };
  }

  const denoModule = await import("./mod.ts");
  return denoModule.runCli;
}
