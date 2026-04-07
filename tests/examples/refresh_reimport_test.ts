import { join } from "node:path";

import {
  assert,
  assertSuccess,
  copyExampleToTemp,
  decode,
  readJson,
  REQUIRES_LOCAL_DENO_FIXTURE,
  runExampleActivated,
  withLocalDenoSources,
} from "./_example_test_utils.ts";

Deno.test({
  name:
    "refresh and reimport smoke: the documented flow makes the staged app and imported tool runnable",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("06-refresh-reimport");
    await withLocalDenoSources(async (env) => {
      const output = await runExampleActivated(
        projectDir,
        "cp -R ./incoming-apps/admin-console ./apps/admin-console && alteran refresh && alteran reimport tools ./incoming-tools && alteran app run admin-console && alteran tool run audit-report",
        env,
      );

      assertSuccess(output, "refresh and reimport smoke");

      const stdout = decode(output.stdout);
      assert(
        stdout.includes("admin-console imported unit:admin-console"),
        "Expected refreshed app output",
      );
      assert(
        stdout.includes("audit imported unit:audit-report"),
        "Expected reimported tool output",
      );
    });
  },
});

Deno.test({
  name:
    "refresh and reimport scenario: config and workspace are synchronized after structural changes",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("06-refresh-reimport");
    await withLocalDenoSources(async (env) => {
      const flow = await runExampleActivated(
        projectDir,
        "cp -R ./incoming-apps/admin-console ./apps/admin-console && alteran refresh && alteran reimport tools ./incoming-tools >/dev/null",
        env,
      );
      assertSuccess(flow, "refresh and reimport scenario");

      const config = await readJson(join(projectDir, "alteran.json")) as {
        apps: Record<string, { path: string }>;
        tools: Record<string, { path: string }>;
      };
      const rootDeno = await readJson(join(projectDir, "deno.json")) as {
        workspace?: string[];
      };

      assert(
        config.apps["admin-console"]?.path === "./apps/admin-console",
        "Expected refreshed app registry entry for admin-console",
      );
      assert(
        config.tools["audit-report"]?.path ===
          "./incoming-tools/audit-report.ts",
        "Expected imported tool registry entry for audit-report",
      );
      assert(
        rootDeno.workspace?.includes("./apps/admin-console") === true,
        "Expected admin-console to appear in the managed workspace list",
      );
    });
  },
});
