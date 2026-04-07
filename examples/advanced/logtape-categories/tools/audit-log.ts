import { main } from "./audit-log/mod.ts";

if (import.meta.main) {
  await main(Deno.args);
}
