function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RUN_FROM_LOCAL_EXAMPLE = resolve(Deno.cwd()) ===
  dirname(dirname(fileURLToPath(import.meta.url)));

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
  name: "internal: pipeline tool keeps nested child runs linked and visible",
  ignore: !RUN_FROM_LOCAL_EXAMPLE,
  async fn() {
    const output = await runAlteran(["tool", "run", "run-pipeline", "nested"]);
    assertSuccess(output, "run-pipeline nested");

    const stdout = decode(output.stdout);
    const stderr = decode(output.stderr);
    assert(
      stdout.includes("parent stdout nested"),
      `Expected parent stdout marker, got: ${stdout}`,
    );
    assert(
      stdout.includes("child stdout nested"),
      `Expected child stdout marker, got: ${stdout}`,
    );
    assert(
      stderr.includes("parent stderr marker") &&
        stderr.includes("child stderr marker"),
      `Expected parent and child stderr markers, got: ${stderr}`,
    );
  },
});
