type DenoCliRuntime = {
  args: string[];
  exit(code?: number): never;
};

type NodeCliProcess = {
  argv: string[];
  exit(code?: number): never;
  versions?: {
    node?: string;
  };
};

export type CliRunner = (args: string[]) => Promise<number>;

export function getDenoRuntime(): DenoCliRuntime | null {
  const value = (globalThis as Record<string, unknown>).Deno;
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as DenoCliRuntime;
}

export function getNodeProcess(): NodeCliProcess | null {
  const value = (globalThis as Record<string, unknown>).process;
  if (!value || typeof value !== "object") {
    return null;
  }
  const nodeProcess = value as NodeCliProcess;
  return nodeProcess.versions?.node ? nodeProcess : null;
}

export function isDeno(): boolean {
  return getDenoRuntime() !== null;
}

export function isNode(): boolean {
  return getNodeProcess() !== null;
}

export async function isMain(
  entryUrl: string,
  denoImportMetaMain: boolean,
): Promise<boolean> {
  const denoRuntime = getDenoRuntime();
  if (denoRuntime) {
    return denoImportMetaMain;
  }

  const nodeProcess = getNodeProcess();
  if (!nodeProcess) {
    return false;
  }

  const [{ resolve }, { fileURLToPath }] = await Promise.all([
    import("node:path"),
    import("node:url"),
  ]);
  const invokedPath = nodeProcess.argv[1];
  if (!invokedPath) {
    return false;
  }
  return resolve(invokedPath) === resolve(fileURLToPath(entryUrl));
}

export function getCliArgs(): string[] {
  const denoRuntime = getDenoRuntime();
  if (denoRuntime) {
    return denoRuntime.args;
  }
  return getNodeProcess()?.argv.slice(2) ?? [];
}

export function exitCli(code: number): never {
  const denoRuntime = getDenoRuntime();
  if (denoRuntime) {
    denoRuntime.exit(code);
  }

  const nodeProcess = getNodeProcess();
  if (nodeProcess) {
    nodeProcess.exit(code);
  }

  throw new Error("Unsupported platform");
}

export async function loadCliRunner(): Promise<CliRunner> {
  if (isDeno()) {
    const denoModule = await import("./mod.ts");
    return denoModule.runCli;
  }

  if (isNode()) {
    const nodeCompatModule = await import("./node_compat.ts");
    return nodeCompatModule.runNodeCompatCli;
  }

  throw new Error("Unsupported platform: Alteran requires Deno or Node.js.");
}
