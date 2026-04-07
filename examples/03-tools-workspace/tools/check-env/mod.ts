import { renderRows } from "@libs/table";

export function main(): void {
  console.log(
    renderRows([
      ["alteran_home", Deno.env.get("ALTERAN_HOME") ?? "<unset>"],
      ["run_id", Deno.env.get("ALTERAN_RUN_ID") ?? "<unset>"],
      ["root_log_dir", Deno.env.get("ALTERAN_ROOT_LOG_DIR") ?? "<unset>"],
    ]),
  );
}
