import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { summarizeArgs } from "@libs/run_summary";

export async function main(args: string[]): Promise<void> {
  console.log(`parent stdout ${summarizeArgs(args)}`);
  console.error("parent stderr marker");

  const alteranHome = Deno.env.get("ALTERAN_HOME");
  if (!alteranHome) {
    throw new Error("ALTERAN_HOME is required for the logging example");
  }

  const alteranEntry = join(alteranHome, "alteran", "mod.ts");
  const childPath = join(dirname(fileURLToPath(import.meta.url)), "child.ts");
  const output = await new Deno.Command("deno", {
    args: ["run", "-A", alteranEntry, "run", childPath, ...args],
    stdout: "piped",
    stderr: "piped",
  }).output();

  await Deno.stdout.write(output.stdout);
  await Deno.stderr.write(output.stderr);

  if (!output.success) {
    throw new Error(`child run failed with exit code ${output.code}`);
  }
}
