import {
  exitCli,
  getCliArgs,
  isMain,
  loadCliRunner,
} from "./src/alteran/entry_runtime.ts";

export async function runCli(args: string[]): Promise<number> {
  const cliRunner = await loadCliRunner();
  return await cliRunner(args);
}

if (await isMain(import.meta.url, import.meta.main)) {
  exitCli(await runCli(getCliArgs()));
}
