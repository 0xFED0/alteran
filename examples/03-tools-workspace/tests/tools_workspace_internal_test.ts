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

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RUN_FROM_LOCAL_EXAMPLE = resolve(Deno.cwd()) ===
  dirname(dirname(fileURLToPath(import.meta.url)));

Deno.test({
  name: "internal: example tools remain runnable through local project tasks",
  ignore: !RUN_FROM_LOCAL_EXAMPLE,
  async fn() {
  const envCheck = await runAlteran(["tool", "run", "check-env"]);
  const releaseNotes = await runAlteran([
    "tool",
    "run",
    "release-notes",
    "0.3.0",
    "added",
    "fixed",
  ]);

  assertSuccess(envCheck, "check-env tool");
  assertSuccess(releaseNotes, "release-notes tool");

  const envStdout = decode(envCheck.stdout);
  const releaseStdout = decode(releaseNotes.stdout);

  assert(
    envStdout.includes("alteran_home: "),
    `Expected managed environment output, got: ${envStdout}`,
  );
  assert(
    releaseStdout.includes("item_1: added") &&
      releaseStdout.includes("item_2: fixed"),
    `Expected formatted release notes rows, got: ${releaseStdout}`,
  );
  },
});
