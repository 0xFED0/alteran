export function main(): void {
  const preinit = (globalThis as Record<string, unknown>).__alteran_preinit__ as
    | Record<string, string | null | undefined>
    | undefined;
  const managed = Boolean(preinit?.run_id && Deno.env.get("ALTERAN_HOME"));

  console.log(`managed=${managed ? "yes" : "no"}`);
  console.log(`alteran_home=${Deno.env.get("ALTERAN_HOME") ?? "<unset>"}`);
  console.log(`run_id=${preinit?.run_id ?? "<unset>"}`);
  console.log(`root_log_dir=${preinit?.root_log_dir ?? "<unset>"}`);
}
