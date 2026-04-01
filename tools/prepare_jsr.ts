import { main } from "./prepare_jsr/mod.ts";

if (import.meta.main) {
  await main(Deno.args);
}
