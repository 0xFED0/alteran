import { main } from "./check-env/mod.ts";

if (import.meta.main) {
  await main(Deno.args);
}
