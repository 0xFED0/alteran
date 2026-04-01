export * from "./src/alteran/mod.ts";

import { runCli } from "./src/alteran/mod.ts";

if (import.meta.main) {
  const exitCode = await runCli(Deno.args);
  Deno.exit(exitCode);
}
