import { greetingFor } from "@libs/greeting";
import { describeWorkspace } from "@libs/workspace_info";

export function main(args: string[]): void {
  console.log("ops-report");
  console.log(greetingFor("ops-report"));
  console.log(describeWorkspace());
  console.log(`args=${args.join(",") || "<none>"}`);
}

if (import.meta.main) {
  main(Deno.args);
}
