import { withCategoryAndContext } from "@alteran/logging/logtape_ext";
import { getLogger } from "@logtape/logtape";
import { join } from "node:path";

import { normalizeJobName } from "@libs/context_helpers";

async function appendManagedLogtapeEvent(
  message: string,
  category: string[],
  context: Record<string, unknown>,
): Promise<void> {
  const rootLogDir = Deno.env.get("ALTERAN_ROOT_LOG_DIR");
  if (!rootLogDir) {
    return;
  }

  await Deno.writeTextFile(
    join(rootLogDir, "events.jsonl"),
    `${
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "info",
        msg: message,
        category,
        source: "logtape",
        event_type: "structured_log",
        run_id: Deno.env.get("ALTERAN_RUN_ID"),
        root_run_id: Deno.env.get("ALTERAN_ROOT_RUN_ID"),
        parent_run_id: Deno.env.get("ALTERAN_PARENT_RUN_ID") || null,
        ...context,
      })
    }\n`,
    { append: true },
  );
}

export async function main(args: string[]): Promise<void> {
  const job = normalizeJobName(args[0]);
  const baseLogger = getLogger(["example", "audit"]);

  await withCategoryAndContext(
    ["example", "audit"],
    { job },
    async (logger) => {
      await logger.info("starting audit job", { stage: "prepare" });
      await appendManagedLogtapeEvent(
        "starting audit job",
        ["example", "audit"],
        { job, stage: "prepare" },
      );
      const childLogger = baseLogger.with({ job, stage: "run" });
      await childLogger.info("audit job finished");
      await appendManagedLogtapeEvent(
        "audit job finished",
        ["example", "audit"],
        { job, stage: "run" },
      );
    },
  );

  console.log(`audit-log completed for ${job}`);
}
