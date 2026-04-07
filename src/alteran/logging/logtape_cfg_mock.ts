import { join } from "node:path";

export * from "npm:@logtape/logtape";

async function appendBootstrapEvent(): Promise<void> {
  const rootDir = Deno.env.get("ALTERAN_ROOT_LOG_DIR");
  if (!rootDir) {
    return;
  }

  await Deno.writeTextFile(
    join(rootDir, "events.jsonl"),
    `${JSON.stringify({
      ts: new Date().toISOString(),
      level: "debug",
      msg: "logtape proxy loaded",
      category: ["alteran", "logging", "logtape"],
      source: "alteran",
      event_type: "logtape_proxy_loaded",
      run_id: Deno.env.get("ALTERAN_RUN_ID"),
      root_run_id: Deno.env.get("ALTERAN_ROOT_RUN_ID"),
      parent_run_id: Deno.env.get("ALTERAN_PARENT_RUN_ID") || null,
    })}\n`,
    { append: true },
  );
}

const logtapeSetting = Deno.env.get("ALTERAN_LOGTAPE_ENABLED")?.trim() ?? "";

if (logtapeSetting && logtapeSetting !== "false" && logtapeSetting !== "0") {
  await appendBootstrapEvent();
}
