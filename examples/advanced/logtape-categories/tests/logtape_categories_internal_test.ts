import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RUN_FROM_LOCAL_EXAMPLE = resolve(Deno.cwd()) ===
  dirname(dirname(fileURLToPath(import.meta.url)));

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function runAlteran(args: string[]): Promise<Deno.CommandOutput> {
  return await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "./.runtime/alteran/mod.ts", ...args],
    cwd: Deno.cwd(),
    stdout: "piped",
    stderr: "piped",
  }).output();
}

function assertSuccess(output: Deno.CommandOutput, label: string): void {
  if (!output.success) {
    throw new Error(
      `${label} failed. stdout=${decode(output.stdout)} stderr=${
        decode(output.stderr)
      }`,
    );
  }
}

Deno.test({
  name: "internal: audit-log remains locally runnable and emits logtape events",
  ignore: !RUN_FROM_LOCAL_EXAMPLE,
  async fn() {
    const output = await runAlteran(["tool", "run", "audit-log", "nightly-sync"]);
    assertSuccess(output, "audit-log tool");

    const stdout = decode(output.stdout);
    assert(
      stdout.includes("audit-log completed for nightly-sync"),
      `Expected completion output, got: ${stdout}`,
    );

    const events = await Deno.readTextFile(".runtime/logs/tools/" +
      (await Array.fromAsync(Deno.readDir(".runtime/logs/tools")))
        .filter((entry) => entry.isDirectory)
        .map((entry) => entry.name)
        .sort()
        .at(-1)! + "/events.jsonl");
    assert(
      events.includes('"source":"logtape"'),
      "Expected logtape-sourced events in managed logs",
    );
    assert(
      events.includes('"job":"nightly-sync"'),
      "Expected job context in audit-log events",
    );
  },
});
