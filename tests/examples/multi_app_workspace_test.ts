import { join } from "node:path";

import {
  assert,
  assertSuccess,
  copyExampleToTemp,
  decode,
  readJson,
  REQUIRES_LOCAL_DENO_FIXTURE,
  runExampleActivated,
  runExampleSetup,
  withLocalDenoSources,
} from "./_example_test_utils.ts";

Deno.test({
  name:
    "multi app workspace smoke: the documented setup and activation flow runs both apps",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("02-multi-app-workspace");
    await withLocalDenoSources(async (env) => {
      const output = await runExampleActivated(
        projectDir,
        "alteran app run hello-cli && alteran app run ops-report",
        env,
      );

      assertSuccess(output, "multi app workspace smoke");

      const stdout = decode(output.stdout);
      assert(
        stdout.includes("local override greeting for hello-cli"),
        "Expected hello-cli to use its app-local library override",
      );
      assert(
        stdout.includes("shared greeting for ops-report"),
        "Expected ops-report to use the root shared library",
      );
    });
  },
});

Deno.test({
  name:
    "multi app workspace scenario: setup keeps workspace entries and app tasks synchronized",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("02-multi-app-workspace");
    await withLocalDenoSources(async (env) => {
      const setup = await runExampleSetup(projectDir, env);
      assertSuccess(setup, "multi app workspace setup");

      const rootDeno = await readJson(join(projectDir, "deno.json")) as {
        tasks?: Record<string, string>;
        workspace?: string[];
      };

      assert(
        JSON.stringify(rootDeno.workspace) ===
          JSON.stringify(["./apps/hello-cli", "./apps/ops-report"]),
        "Expected root workspace to include both apps",
      );
      assert(
        rootDeno.tasks?.["app:hello-cli"] ===
          "deno run -A ./alteran.ts app run hello-cli",
        "Expected generated hello-cli task",
      );
      assert(
        rootDeno.tasks?.["app:ops-report"] ===
          "deno run -A ./alteran.ts app run ops-report",
        "Expected generated ops-report task",
      );
    });
  },
});
