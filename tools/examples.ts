import { main } from "./examples/mod.ts";

if (import.meta.main) {
  await main(Deno.args);
}
