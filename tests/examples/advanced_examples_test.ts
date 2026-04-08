import { join } from "node:path";

import { exists } from "../../src/alteran/fs.ts";
import {
  assert,
  assertSuccess,
  copyExampleToTemp,
  decode,
  latestLogDir,
  REQUIRES_LOCAL_DENO_FIXTURE,
  runExampleActivated,
  runShell,
  startLocalDenoFixture,
  withLocalDenoSources,
} from "./_example_test_utils.ts";

Deno.test({
  name:
    "advanced logtape categories smoke: the documented flow emits logtape events into managed logs",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("advanced/logtape-categories");
    await withLocalDenoSources(async (env) => {
      const output = await runExampleActivated(
        projectDir,
        "alteran tool run audit-log nightly-sync",
        env,
      );

      assertSuccess(output, "advanced audit-log tool");
      assert(
        decode(output.stdout).includes("audit-log completed for nightly-sync"),
        "Expected audit-log completion message",
      );

      const logDir = await latestLogDir(projectDir, "tools");
      const events = await Deno.readTextFile(join(logDir, "events.jsonl"));
      assert(
        events.includes('"source":"logtape"'),
        "Expected logtape-sourced events",
      );
      assert(
        events.includes('"job":"nightly-sync"'),
        "Expected job context in log events",
      );
    });
  },
});

Deno.test({
  name:
    "advanced standalone app runtime scenario: setup regenerates the launcher and later launches reuse the app-local runtime",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const exampleDir = await copyExampleToTemp(
      "advanced/standalone-app-runtime",
    );
    const standaloneDir = join(exampleDir, "standalone-clock");
    const fixture = await startLocalDenoFixture();

    try {
      const setup = await runShell(
        `cd ${JSON.stringify(standaloneDir)} && ./setup >/dev/null`,
        { DENO_SOURCES: fixture.baseUrl },
      );
      assertSuccess(setup, "standalone clock setup");
      assert(
        await exists(join(standaloneDir, "app")),
        "Expected setup to regenerate the standalone app launcher",
      );

      await Deno.remove(join(standaloneDir, ".runtime"), { recursive: true });

      const firstLaunch = await runShell(
        `cd ${JSON.stringify(standaloneDir)} && ./app red blue`,
        { DENO_SOURCES: fixture.baseUrl },
      );

      assertSuccess(firstLaunch, "standalone clock first launch");
      const firstStdout = decode(firstLaunch.stdout);
      assert(
        firstStdout.includes("Standalone app standalone-clock started"),
        "Expected standalone app output on first launch",
      );
      assert(
        firstStdout.includes("red") && firstStdout.includes("blue"),
        "Expected standalone launcher args to propagate on first launch",
      );
      assert(
        await exists(join(standaloneDir, ".runtime")),
        "Expected launcher-triggered setup to rematerialize app-local runtime",
      );

      const secondLaunch = await runShell(
        `cd ${JSON.stringify(standaloneDir)} && ./app green`,
        { DENO_SOURCES: fixture.baseUrl },
      );

      assertSuccess(secondLaunch, "standalone clock second launch");
      const secondStdout = decode(secondLaunch.stdout);
      assert(
        secondStdout.includes("Standalone app standalone-clock started"),
        "Expected standalone app output on second launch",
      );
      assert(
        secondStdout.includes("green"),
        "Expected second launch args to propagate",
      );
    } finally {
      await fixture.close();
    }
  },
});
