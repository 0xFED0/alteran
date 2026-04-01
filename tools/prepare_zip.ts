import { main } from "./prepare_zip/mod.ts";

if (import.meta.main) {
  await main(Deno.args);
}
