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

async function copyDirectory(sourceDir: string, targetDir: string): Promise<void> {
  await Deno.mkdir(targetDir, { recursive: true });
  for await (const entry of Deno.readDir(sourceDir)) {
    const sourcePath = `${sourceDir}/${entry.name}`;
    const targetPath = `${targetDir}/${entry.name}`;
    if (entry.isDirectory) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile) {
      await Deno.copyFile(sourcePath, targetPath);
    }
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
  name: "internal: refresh and reimport can stage new app and tool content from within the example",
  ignore: !RUN_FROM_LOCAL_EXAMPLE,
  async fn() {
    await copyDirectory("./incoming-apps/admin-console", "./apps/admin-console");

    const refresh = await runAlteran(["refresh"]);
    const reimport = await runAlteran(["reimport", "tools", "./incoming-tools"]);
    const appRun = await runAlteran(["app", "run", "admin-console"]);
    const toolRun = await runAlteran(["tool", "run", "audit-report"]);

    assertSuccess(refresh, "refresh after staging admin-console");
    assertSuccess(reimport, "reimport incoming tools");
    assertSuccess(appRun, "admin-console app");
    assertSuccess(toolRun, "audit-report tool");

    const appStdout = decode(appRun.stdout);
    const toolStdout = decode(toolRun.stdout);
    assert(
      appStdout.includes("admin-console imported unit:admin-console"),
      `Expected refreshed app output, got: ${appStdout}`,
    );
    assert(
      toolStdout.includes("audit imported unit:audit-report"),
      `Expected reimported tool output, got: ${toolStdout}`,
    );
  },
});
