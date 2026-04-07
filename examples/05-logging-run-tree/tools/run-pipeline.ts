import { main } from "./run-pipeline/mod.ts";

if (import.meta.main) {
  await main(Deno.args);
}
