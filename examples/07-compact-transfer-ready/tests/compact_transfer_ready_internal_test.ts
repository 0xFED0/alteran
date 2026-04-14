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

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
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
  name: "internal: compact removes regenerable state while preserving authored project files",
  ignore: !RUN_FROM_LOCAL_EXAMPLE,
  async fn() {
    const appRun = await runAlteran(["app", "run", "portable-cli"]);
    const toolRun = await runAlteran(["tool", "run", "project-status"]);
    const compact = await runAlteran(["compact", "-y"]);

    assertSuccess(appRun, "portable-cli app");
    assertSuccess(toolRun, "project-status tool");
    assertSuccess(compact, "compact project");

    assert(!(await exists(".runtime")), "Expected root .runtime to be removed");
    assert(!(await exists("activate")), "Expected activate to be removed");
    assert(
      !(await exists("activate.bat")),
      "Expected activate.bat to be removed",
    );
    assert(await exists("setup"), "Expected setup to remain after compact");
    assert(
      await exists("alteran.json"),
      "Expected alteran.json to remain after compact",
    );
  },
});
