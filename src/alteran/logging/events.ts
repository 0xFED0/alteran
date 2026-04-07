import { join } from "node:path";

import { detectPlatform } from "../platform.ts";
import type { AlteranConfig, LogContext } from "../types.ts";
import { ensureDir, slugify } from "../fs.ts";
import { ALTERAN_VERSION } from "../version.ts";

export interface LogSession {
  context: LogContext;
  rootDir: string;
  stdoutPath: string;
  stderrPath: string;
  eventsPath: string;
  metadataPath: string;
  config: AlteranConfig;
}

function topLevelLogDir(type: string): string {
  switch (type) {
    case "app":
      return "apps";
    case "tool":
      return "tools";
    case "task":
      return "tasks";
    case "test":
      return "tests";
    default:
      return "runs";
  }
}

function createRunId(name: string): string {
  const iso = new Date().toISOString().replaceAll(/[-:]/g, "").replace(
    ".000",
    "",
  );
  return `${iso}_${slugify(name)}`;
}

async function appendJsonLine(
  path: string,
  value: Record<string, unknown>,
): Promise<void> {
  await Deno.writeTextFile(path, `${JSON.stringify(value)}\n`, {
    append: true,
  });
}

export async function startLogSession(
  projectDir: string,
  config: AlteranConfig,
  type: string,
  name: string,
  argv: string[],
): Promise<LogSession> {
  const runId = createRunId(name);
  const rootDir = join(
    projectDir,
    ".runtime",
    "logs",
    topLevelLogDir(type),
    runId,
  );
  await ensureDir(rootDir);

  const context: LogContext = {
    run_id: runId,
    root_run_id: runId,
    parent_run_id: Deno.env.get("ALTERAN_RUN_ID") ?? null,
    name,
    type,
  };

  const session: LogSession = {
    context,
    rootDir,
    stdoutPath: join(rootDir, "stdout.log"),
    stderrPath: join(rootDir, "stderr.log"),
    eventsPath: join(rootDir, "events.jsonl"),
    metadataPath: join(rootDir, "metadata.json"),
    config,
  };

  await Deno.writeTextFile(
    session.metadataPath,
    JSON.stringify(
      {
        type,
        name,
        run_id: context.run_id,
        root_run_id: context.root_run_id,
        parent_run_id: context.parent_run_id,
        cwd: projectDir,
        argv,
        started_at: new Date().toISOString(),
        exit_code: null,
        pid: Deno.pid,
        alteran_version: ALTERAN_VERSION,
        deno_version: Deno.version.deno,
        platform: detectPlatform().id,
      },
      null,
      2,
    ) + "\n",
  );

  await appendJsonLine(session.eventsPath, {
    ts: new Date().toISOString(),
    level: "info",
    msg: `${type} started`,
    category: ["alteran", type, name],
    run_id: context.run_id,
    root_run_id: context.root_run_id,
    parent_run_id: context.parent_run_id,
    source: "alteran",
    event_type: "lifecycle",
    argv,
  });

  return session;
}

export async function appendEvent(
  session: LogSession,
  event: Record<string, unknown>,
): Promise<void> {
  await appendJsonLine(session.eventsPath, {
    ts: new Date().toISOString(),
    run_id: session.context.run_id,
    root_run_id: session.context.root_run_id,
    parent_run_id: session.context.parent_run_id,
    ...event,
  });
}

export async function finishLogSession(
  session: LogSession,
  exitCode: number,
): Promise<void> {
  await appendEvent(session, {
    level: exitCode === 0 ? "info" : "error",
    msg: "process finished",
    category: ["alteran", session.context.type, session.context.name],
    source: "alteran",
    event_type: "process_exited",
    exit_code: exitCode,
  });

  const metadata = JSON.parse(await Deno.readTextFile(session.metadataPath));
  metadata.finished_at = new Date().toISOString();
  metadata.exit_code = exitCode;
  await Deno.writeTextFile(
    session.metadataPath,
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
}

export function createManagedEnv(
  projectDir: string,
  session: LogSession,
): Record<string, string> {
  const platform = detectPlatform();
  const runtimeRoot = join(projectDir, ".runtime");
  const platformRoot = join(runtimeRoot, "deno", platform.id);
  const existingPath = Deno.env.get("PATH") ?? "";

  return {
    ...Deno.env.toObject(),
    ALTERAN_HOME: runtimeRoot,
    ALTERAN_RUN_ID: session.context.run_id,
    ALTERAN_ROOT_RUN_ID: session.context.root_run_id,
    ALTERAN_PARENT_RUN_ID: session.context.parent_run_id ?? "",
    ALTERAN_ROOT_LOG_DIR: session.rootDir,
    ALTERAN_LOG_MODE: "root",
    ALTERAN_LOG_CONTEXT_JSON: JSON.stringify({
      context: session.context,
      category: ["alteran", session.context.type, session.context.name],
    }),
    DENO_DIR: join(platformRoot, "cache"),
    DENO_INSTALL_ROOT: platformRoot,
    PATH: `${
      join(platformRoot, "bin")
    }${platform.pathSeparator}${existingPath}`,
  };
}

export async function captureStream(
  stream: ReadableStream<Uint8Array>,
  targetPath: string,
  mirror: "stdout" | "stderr" | "none",
): Promise<void> {
  const file = await Deno.open(targetPath, {
    create: true,
    append: true,
    write: true,
  });
  const target = mirror === "stdout"
    ? Deno.stdout
    : mirror === "stderr"
    ? Deno.stderr
    : null;

  try {
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      await file.write(value);
      if (target) {
        await target.write(value);
      }
    }
  } finally {
    file.close();
  }
}
