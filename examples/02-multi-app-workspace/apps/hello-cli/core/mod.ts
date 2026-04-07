import { greetingFor } from "@libs/greeting";
import { describeWorkspace } from "@libs/workspace_info";

export function main(args: string[]): void {
  console.log("hello-cli");
  console.log(greetingFor("hello-cli"));
  console.log(describeWorkspace());
  console.log(`args=${args.join(",") || "<none>"}`);
}

if (import.meta.main) {
  main(Deno.args);
}
