import { withCategoryAndContext } from "@alteran/logging/logtape_ext";
import { getLogger } from "@logtape/logtape";

import { normalizeJobName } from "@libs/context_helpers";

export async function main(args: string[]): Promise<void> {
  const job = normalizeJobName(args[0]);
  const baseLogger = getLogger(["example", "audit"]);

  await withCategoryAndContext(
    ["example", "audit"],
    { job },
    async (logger) => {
      await logger.info("starting audit job", { stage: "prepare" });
      const childLogger = baseLogger.with({ job, stage: "run" });
      await childLogger.info("audit job finished");
    },
  );

  console.log(`audit-log completed for ${job}`);
}
