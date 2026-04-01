import { join } from "node:path";

const context = {
  run_id: Deno.env.get("ALTERAN_RUN_ID"),
  root_run_id: Deno.env.get("ALTERAN_ROOT_RUN_ID"),
  parent_run_id: Deno.env.get("ALTERAN_PARENT_RUN_ID"),
  root_log_dir: Deno.env.get("ALTERAN_ROOT_LOG_DIR"),
  mode: Deno.env.get("ALTERAN_LOG_MODE") ?? "disabled",
};

(globalThis as Record<string, unknown>).__alteran_preinit__ = context;

if (context.root_log_dir) {
  await Deno.writeTextFile(
    join(context.root_log_dir, "events.jsonl"),
    `${
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "debug",
        msg: "preinit loaded",
        category: ["alteran", "runtime", "preinit"],
        run_id: context.run_id,
        root_run_id: context.root_run_id,
        parent_run_id: context.parent_run_id || null,
        source: "alteran",
        event_type: "lifecycle",
      })
    }\n`,
    { append: true },
  );
}

export function getAlteranPreinitContext() {
  return context;
}
