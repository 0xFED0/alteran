import { join, relative, resolve } from "node:path";

import { configure, fromAsyncSink } from "npm:@logtape/logtape";

import { parseJsonc } from "../jsonc.ts";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonRecord(raw: string | undefined, name: string): JsonRecord {
  if (!raw) {
    return {};
  }
  const parsed = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error(`${name} must contain a JSON object`);
  }
  return parsed;
}

function flattenProperties(properties: Record<string, unknown>): JsonRecord {
  const flattened: JsonRecord = {};
  for (const [key, value] of Object.entries(properties)) {
    if (
      ![
        "ts",
        "level",
        "msg",
        "category",
        "source",
        "event_type",
        "run_id",
        "root_run_id",
        "parent_run_id",
        "alteran_category",
        "properties",
      ].includes(key)
    ) {
      flattened[key] = value;
    }
  }
  return flattened;
}

function stringifyMessage(record: { message: readonly unknown[] }): string {
  if (record.message.length === 1) {
    return String(record.message[0]);
  }

  let message = "";
  for (let index = 0; index < record.message.length; index++) {
    const part = record.message[index];
    message += index % 2 === 0 ? String(part) : JSON.stringify(part);
  }
  return message;
}

function appendJsonLine(
  path: string,
  value: Record<string, unknown>,
): Promise<void> {
  return Deno.writeTextFile(path, `${JSON.stringify(value)}\n`, { append: true });
}

function resolveMirrorEventsPath(rootLogDir: string): string | undefined {
  const customLogDir = Deno.env.get("ALTERAN_CUSTOM_LOG_DIR")?.trim();
  const alteranHome = Deno.env.get("ALTERAN_HOME")?.trim();
  if (!customLogDir || !alteranHome) {
    return undefined;
  }

  const canonicalLogsRoot = resolve(join(alteranHome, "logs"));
  const relativeRoot = relative(canonicalLogsRoot, resolve(rootLogDir));
  if (relativeRoot.startsWith("..")) {
    return undefined;
  }

  return join(resolve(customLogDir), relativeRoot, "events.jsonl");
}

function createEventsSink() {
  const rootLogDir = Deno.env.get("ALTERAN_ROOT_LOG_DIR")?.trim();
  if (!rootLogDir) {
    return fromAsyncSink(async () => {});
  }

  const eventsPath = join(rootLogDir, "events.jsonl");
  const mirrorEventsPath = resolveMirrorEventsPath(rootLogDir);
  const logContext = parseJsonRecord(
    Deno.env.get("ALTERAN_LOG_CONTEXT_JSON"),
    "ALTERAN_LOG_CONTEXT_JSON",
  );
  const alteranCategory = Array.isArray(logContext.category)
    ? logContext.category
    : undefined;

  return fromAsyncSink(async (record) => {
    const properties = { ...(record.properties ?? {}) };
    const event = {
      ts: new Date(record.timestamp).toISOString(),
      level: record.level,
      msg: stringifyMessage(record),
      category: [...record.category],
      ...(alteranCategory ? { alteran_category: alteranCategory } : {}),
      source: "logtape",
      event_type: "structured_log",
      run_id: Deno.env.get("ALTERAN_RUN_ID"),
      root_run_id: Deno.env.get("ALTERAN_ROOT_RUN_ID"),
      parent_run_id: Deno.env.get("ALTERAN_PARENT_RUN_ID") || null,
      properties,
      ...flattenProperties(properties),
    };

    await appendJsonLine(eventsPath, event);
    if (mirrorEventsPath && resolve(mirrorEventsPath) !== resolve(eventsPath)) {
      await appendJsonLine(mirrorEventsPath, event);
    }
  });
}

function mergeLogtapeConfigValue(
  base: unknown,
  override: unknown,
  path: string[] = [],
): unknown {
  if (override === undefined) {
    return base;
  }
  if (base === undefined) {
    return override;
  }

  if (
    path.at(-1) === "loggers" &&
    Array.isArray(base) &&
    Array.isArray(override)
  ) {
    return [...base, ...override];
  }

  if (Array.isArray(base) || Array.isArray(override)) {
    return override;
  }

  if (isRecord(base) && isRecord(override)) {
    const result: JsonRecord = { ...base };
    for (const [key, value] of Object.entries(override)) {
      result[key] = mergeLogtapeConfigValue(result[key], value, [...path, key]);
    }
    return result;
  }

  return override;
}

export function buildAlteranDefaultLogtapeConfig(): JsonRecord {
  return {
    reset: true,
    sinks: {
      alteran_events: createEventsSink(),
    },
    loggers: [
      {
        category: [],
        lowestLevel: "trace",
        sinks: ["alteran_events"],
      },
    ],
  };
}

export function buildAlteranLogtapeConfig(
  userConfig: JsonRecord = {},
): JsonRecord {
  return mergeLogtapeConfigValue(
    buildAlteranDefaultLogtapeConfig(),
    userConfig,
  ) as JsonRecord;
}

export async function readUserLogtapeConfigFromProject(): Promise<JsonRecord> {
  const alteranHome = Deno.env.get("ALTERAN_HOME")?.trim();
  if (!alteranHome) {
    return {};
  }

  const projectDir = resolve(alteranHome, "..");
  const configPath = join(projectDir, "alteran.json");
  let rawConfig = "";
  try {
    rawConfig = await Deno.readTextFile(configPath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return {};
    }
    throw error;
  }

  const parsed = parseJsonc<Record<string, unknown>>(rawConfig, {});
  const logging = isRecord(parsed.logging) ? parsed.logging : {};
  const logtape = logging.logtape;

  if (
    logtape === undefined || logtape === null || logtape === false ||
    logtape === true
  ) {
    return {};
  }
  if (!isRecord(logtape)) {
    throw new Error(
      "logging.logtape must be false, true, or an object in alteran.json",
    );
  }
  return logtape;
}

export async function ensureAlteranLogtapeConfigured(): Promise<void> {
  const setting = Deno.env.get("ALTERAN_LOGTAPE_ENABLED")?.trim() ?? "";
  if (!setting || setting === "false" || setting === "0") {
    return;
  }

  const config = buildAlteranLogtapeConfig(
    await readUserLogtapeConfigFromProject(),
  );
  await configure(config as unknown as Parameters<typeof configure>[0]);
}
