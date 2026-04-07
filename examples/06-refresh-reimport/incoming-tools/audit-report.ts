import { main } from "./audit-report/mod.ts";

if (import.meta.main) {
  await main(Deno.args);
}
