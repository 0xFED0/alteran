import { dirname, isAbsolute, join, relative, resolve } from "node:path";

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
  customRootDir?: string;
  customStdoutPath?: string;
  customStderrPath?: string;
  customEventsPath?: string;
  customMetadataPath?: string;
  config: AlteranConfig;
  isRootSession: boolean;
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

function uniquePaths(paths: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const path of paths) {
    if (!path) {
      continue;
    }
    const normalized = resolve(path);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(path);
  }

  return result;
}

async function writeMirroredText(
  paths: Array<string | undefined>,
  text: string,
  options?: Deno.WriteFileOptions,
): Promise<void> {
  for (const path of uniquePaths(paths)) {
    await ensureDir(dirname(path));
    await Deno.writeTextFile(path, text, options);
  }
}

async function appendJsonLine(
  paths: Array<string | undefined>,
  value: Record<string, unknown>,
): Promise<void> {
  await writeMirroredText(paths, `${JSON.stringify(value)}\n`, {
    append: true,
  });
}

function resolveCustomRootDir(
  projectLogsRoot: string,
  canonicalRootDir: string,
): string | undefined {
  const configured = Deno.env.get("ALTERAN_CUSTOM_LOG_DIR")?.trim();
  if (!configured) {
    return undefined;
  }

  const relativeRoot = relative(projectLogsRoot, canonicalRootDir);
  if (relativeRoot.startsWith("..") || isAbsolute(relativeRoot)) {
    return undefined;
  }

  return join(resolve(configured), relativeRoot);
}

export async function startLogSession(
  projectDir: string,
  config: AlteranConfig,
  type: string,
  name: string,
  argv: string[],
): Promise<LogSession> {
  const runId = createRunId(name);
  const inheritedRootRunId = Deno.env.get("ALTERAN_ROOT_RUN_ID") ?? null;
  const inheritedRootLogDir = Deno.env.get("ALTERAN_ROOT_LOG_DIR") ?? null;
  const parentRunId = Deno.env.get("ALTERAN_RUN_ID") ?? null;
  const projectLogsRoot = resolve(join(projectDir, ".runtime", "logs"));
  const inheritedRootIsForCurrentProject = inheritedRootLogDir !== null &&
    (() => {
      const relativeRoot = relative(projectLogsRoot, resolve(inheritedRootLogDir));
      return relativeRoot === "" ||
        (!relativeRoot.startsWith("..") && !isAbsolute(relativeRoot));
    })();
  const isRootSession = inheritedRootRunId === null ||
    inheritedRootLogDir === null ||
    !inheritedRootIsForCurrentProject;
  const rootDir = isRootSession
    ? join(
      projectDir,
      ".runtime",
      "logs",
      topLevelLogDir(type),
      runId,
    )
    : inheritedRootLogDir;
  await ensureDir(rootDir);

  const context: LogContext = {
    run_id: runId,
    root_run_id: isRootSession ? runId : (inheritedRootRunId ?? runId),
    parent_run_id: parentRunId,
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
    customRootDir: resolveCustomRootDir(projectLogsRoot, rootDir),
    customStdoutPath: undefined,
    customStderrPath: undefined,
    customEventsPath: undefined,
    customMetadataPath: undefined,
    config,
    isRootSession,
  };

  if (session.customRootDir) {
    await ensureDir(session.customRootDir);
    session.customStdoutPath = join(session.customRootDir, "stdout.log");
    session.customStderrPath = join(session.customRootDir, "stderr.log");
    session.customEventsPath = join(session.customRootDir, "events.jsonl");
    session.customMetadataPath = join(session.customRootDir, "metadata.json");
  }

  if (isRootSession) {
    await writeMirroredText(
      [session.metadataPath, session.customMetadataPath],
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
  }

  await appendJsonLine([session.eventsPath, session.customEventsPath], {
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
  await appendJsonLine([session.eventsPath, session.customEventsPath], {
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

  if (session.isRootSession) {
    const metadata = JSON.parse(await Deno.readTextFile(session.metadataPath));
    metadata.finished_at = new Date().toISOString();
    metadata.exit_code = exitCode;
    await writeMirroredText(
      [session.metadataPath, session.customMetadataPath],
      `${JSON.stringify(metadata, null, 2)}\n`,
    );
  }
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
    ALTERAN_LOG_MODE: session.isRootSession ? "root" : "child",
    ALTERAN_LOGTAPE_ENABLED: String(session.config.logging.logtape !== false),
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
  targetPaths: Array<string | undefined>,
  mirror: "stdout" | "stderr" | "none",
): Promise<void> {
  const files = await Promise.all(
    uniquePaths(targetPaths).map((path) =>
      Deno.open(path, {
        create: true,
        append: true,
        write: true,
      })
    ),
  );
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
      for (const file of files) {
        await file.write(value);
      }
      if (target) {
        await target.write(value);
      }
    }
  } finally {
    for (const file of files) {
      file.close();
    }
  }
}
