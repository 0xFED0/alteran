import { basename, dirname, join, resolve } from "node:path";

type TraceContext = Record<string, unknown>;

let latchedRootLogDir: string | null | undefined;

export const TEST_TRACE_CATEGORY = {
  e2eRepo: ["e2e", "repo"] as const,
  e2eRepoUnix: ["e2e", "repo", "unix"] as const,
  e2eRepoWindows: ["e2e", "repo", "windows"] as const,
  e2eDocker: ["e2e", "docker"] as const,
  e2eExamples: ["e2e", "examples"] as const,
  e2eHarness: ["e2e", "harness"] as const,
  unit: ["unit"] as const,
};

function normalizeCategory(
  category: string | readonly string[],
): string[] {
  if (typeof category === "string") {
    return ["alteran", "tests", category];
  }
  return ["alteran", "tests", ...category];
}

function sanitizeContext(
  context: TraceContext,
): TraceContext {
  const result: TraceContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) {
      continue;
    }
    result[key] = value;
  }
  return result;
}

function initialRootLogDir(): string | null {
  if (latchedRootLogDir !== undefined) {
    return latchedRootLogDir;
  }
  const configured = Deno.env.get("ALTERAN_ROOT_LOG_DIR")?.trim();
  latchedRootLogDir = configured ? resolve(configured) : null;
  return latchedRootLogDir;
}

function resolveTraceEventsPath(currentRootLogDir: string): string {
  const canonicalCurrentRoot = resolve(currentRootLogDir);
  const initialRoot = initialRootLogDir();
  if (!initialRoot || initialRoot === canonicalCurrentRoot) {
    return join(canonicalCurrentRoot, "events.jsonl");
  }
  return join(initialRoot, basename(canonicalCurrentRoot), "events.jsonl");
}

async function appendTraceEvent(
  level: "info" | "warning" | "error",
  category: string | readonly string[],
  message: string,
  context: TraceContext = {},
): Promise<void> {
  try {
    const rootLogDir = Deno.env.get("ALTERAN_ROOT_LOG_DIR")?.trim();
    if (!rootLogDir) {
      return;
    }

    const event = {
      ts: new Date().toISOString(),
      level,
      msg: message,
      category: normalizeCategory(category),
      run_id: Deno.env.get("ALTERAN_RUN_ID"),
      root_run_id: Deno.env.get("ALTERAN_ROOT_RUN_ID"),
      parent_run_id: Deno.env.get("ALTERAN_PARENT_RUN_ID") || null,
      source: "alteran_test_trace",
      event_type: "test_trace",
      ...sanitizeContext(context),
    };

    const eventsPath = resolveTraceEventsPath(rootLogDir);
    await Deno.mkdir(dirname(eventsPath), { recursive: true });
    await Deno.writeTextFile(
      eventsPath,
      `${JSON.stringify(event)}\n`,
      { append: true },
    );
  } catch {
    // Test diagnostics must never become the reason a test fails.
  }
}

export function summarizeEnvKeys(env: Record<string, string>): string[] {
  return Object.entries(env)
    .filter(([, value]) => value !== "")
    .map(([key]) => key)
    .sort();
}

export function sanitizeCommand(command: string): string {
  return command.length > 400 ? `${command.slice(0, 397)}...` : command;
}

export async function traceTestStep(
  category: string | readonly string[],
  message: string,
  context: TraceContext = {},
): Promise<void> {
  await appendTraceEvent("info", category, message, context);
}

export async function traceTestWarning(
  category: string | readonly string[],
  message: string,
  context: TraceContext = {},
): Promise<void> {
  await appendTraceEvent("warning", category, message, context);
}

export async function traceTestError(
  category: string | readonly string[],
  message: string,
  context: TraceContext = {},
): Promise<void> {
  await appendTraceEvent("error", category, message, context);
}

export async function traceCommandStart(
  category: string | readonly string[],
  command: string,
  context: TraceContext = {},
): Promise<void> {
  await traceTestStep(category, "command prepared", {
    ...context,
    command: sanitizeCommand(command),
  });
}

export async function traceCommandResult(
  category: string | readonly string[],
  output: Deno.CommandOutput,
  context: TraceContext = {},
): Promise<void> {
  await appendTraceEvent(
    output.success ? "info" : "warning",
    category,
    "command finished",
    {
      ...context,
      success: output.success,
      code: output.code,
    },
  );
}
