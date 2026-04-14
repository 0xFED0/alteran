function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function runLocal(args: string[]): Promise<Deno.CommandOutput> {
  return await new Deno.Command(Deno.execPath(), {
    args,
    cwd: Deno.cwd(),
    stdout: "piped",
    stderr: "piped",
  }).output();
}

async function runAlteran(args: string[]): Promise<Deno.CommandOutput> {
  return await runLocal(["run", "-A", "./.runtime/alteran/mod.ts", ...args]);
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
  name: "internal: plain and managed execution still expose different context",
  ignore: !RUN_FROM_LOCAL_EXAMPLE,
  async fn() {
  const plain = await runLocal(["run", "-A", "./tools/context-probe.ts"]);
  const managed = await runAlteran(["tool", "run", "context-probe"]);

  assertSuccess(plain, "plain context probe");
  assertSuccess(managed, "managed context probe");

  const plainStdout = decode(plain.stdout);
  const managedStdout = decode(managed.stdout);

  assert(
    plainStdout.includes("managed=no"),
    `Expected plain probe to report managed=no, got: ${plainStdout}`,
  );
  assert(
    managedStdout.includes("managed=yes"),
    `Expected managed probe to report managed=yes, got: ${managedStdout}`,
  );
  },
});
