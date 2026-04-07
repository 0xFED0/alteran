import { main } from "./release-notes/mod.ts";

if (import.meta.main) {
  await main(Deno.args);
}
