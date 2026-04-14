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
  name: "internal: both apps stay runnable through the local project tasks",
  ignore: !RUN_FROM_LOCAL_EXAMPLE,
  async fn() {
  const hello = await runAlteran(["app", "run", "hello-cli"]);
  const ops = await runAlteran(["app", "run", "ops-report"]);

  assertSuccess(hello, "hello-cli app");
  assertSuccess(ops, "ops-report app");

  const helloStdout = decode(hello.stdout);
  const opsStdout = decode(ops.stdout);

  assert(
    helloStdout.includes("local override greeting for hello-cli"),
    `Expected hello-cli local override greeting, got: ${helloStdout}`,
  );
  assert(
    opsStdout.includes("shared greeting for ops-report"),
    `Expected ops-report shared greeting, got: ${opsStdout}`,
  );
  },
});
