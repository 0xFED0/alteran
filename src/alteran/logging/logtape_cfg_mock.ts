import { join } from "node:path";

type Category = string | string[];
type Level = "debug" | "info" | "warn" | "error" | "fatal";

export interface MockLogger {
  category: string[];
  context: Record<string, unknown>;
  debug(message: string, context?: Record<string, unknown>): Promise<void>;
  info(message: string, context?: Record<string, unknown>): Promise<void>;
  warn(message: string, context?: Record<string, unknown>): Promise<void>;
  error(message: string, context?: Record<string, unknown>): Promise<void>;
  fatal(message: string, context?: Record<string, unknown>): Promise<void>;
  with(context: Record<string, unknown>): MockLogger;
}

function normalizeCategory(category: Category): string[] {
  return Array.isArray(category) ? category : [category];
}

async function appendEvent(
  level: Level,
  category: string[],
  message: string,
  context: Record<string, unknown>,
): Promise<void> {
  const rootDir = Deno.env.get("ALTERAN_ROOT_LOG_DIR");
  if (!rootDir) {
    return;
  }

  await Deno.writeTextFile(
    join(rootDir, "events.jsonl"),
    `${
      JSON.stringify({
        ts: new Date().toISOString(),
        level,
        msg: message,
        category,
        source: "logtape",
        event_type: "log",
        run_id: Deno.env.get("ALTERAN_RUN_ID"),
        root_run_id: Deno.env.get("ALTERAN_ROOT_RUN_ID"),
        parent_run_id: Deno.env.get("ALTERAN_PARENT_RUN_ID") || null,
        ...context,
      })
    }\n`,
    { append: true },
  );
}

function createLogger(
  category: string[],
  boundContext: Record<string, unknown> = {},
): MockLogger {
  async function log(
    level: Level,
    message: string,
    context: Record<string, unknown> = {},
  ) {
    await appendEvent(level, category, message, {
      ...boundContext,
      ...context,
    });
  }

  return {
    category,
    context: boundContext,
    debug: (message, context) => log("debug", message, context),
    info: (message, context) => log("info", message, context),
    warn: (message, context) => log("warn", message, context),
    error: (message, context) => log("error", message, context),
    fatal: (message, context) => log("fatal", message, context),
    with: (context) => createLogger(category, { ...boundContext, ...context }),
  };
}

export async function configure(): Promise<void> {
  // Deliberately inert by default.
}

export function getLogger(category: Category): MockLogger {
  return createLogger(normalizeCategory(category));
}

export function reset(): void {
  // No-op in the mock adapter.
}
