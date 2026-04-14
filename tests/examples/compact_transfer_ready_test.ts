import { join } from "node:path";

import { exists } from "../../src/alteran/fs.ts";
import {
  assert,
  assertSuccess,
  copyExampleToTemp,
  REQUIRES_LOCAL_DENO_FIXTURE,
  runExampleActivated,
  runExampleInternalTests,
  withLocalDenoSources,
} from "./_example_test_utils.ts";

Deno.test({
  name:
    "compact transfer ready smoke: compact removes recoverable runtime state and generated activation",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("07-compact-transfer-ready");
    await withLocalDenoSources(async (env) => {
      const output = await runExampleActivated(
        projectDir,
        "alteran app run portable-cli >/dev/null && alteran tool run project-status >/dev/null && mkdir -p dist && printf 'generated\\n' > dist/artifact.txt && mkdir -p apps/portable-cli/.runtime/scratch && alteran compact -y",
        env,
      );

      assertSuccess(output, "compact project");

      assert(
        !(await exists(join(projectDir, ".runtime"))),
        "Expected root .runtime to be removed",
      );
      assert(
        !(await exists(join(projectDir, "dist"))),
        "Expected dist/ to be removed",
      );
      assert(
        !(await exists(join(projectDir, "activate"))),
        "Expected generated activate to be removed",
      );
      assert(
        !(await exists(join(projectDir, "activate.bat"))),
        "Expected generated activate.bat to be removed",
      );
      assert(
        !(await exists(join(projectDir, "apps", "portable-cli", ".runtime"))),
        "Expected nested app runtime to be removed",
      );
    });
  },
});

Deno.test({
  name:
    "compact transfer ready internal tests stay runnable through alteran test",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("07-compact-transfer-ready");
    await withLocalDenoSources(async (env) => {
      const output = await runExampleInternalTests(projectDir, env);
      assertSuccess(output, "compact transfer ready internal tests");
    });
  },
});

Deno.test({
  name:
    "compact transfer ready scenario: setup can rehydrate the compacted example",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("07-compact-transfer-ready");
    await withLocalDenoSources(async (env) => {
      const compact = await runExampleActivated(
        projectDir,
        "alteran compact -y",
        env,
      );
      assertSuccess(compact, "compact before rehydrate");

      const rehydrate = await runExampleActivated(
        projectDir,
        "alteran app run portable-cli >/dev/null",
        env,
      );
      assertSuccess(rehydrate, "rehydrate compacted project");

      assert(
        await exists(join(projectDir, ".runtime", "alteran", "mod.ts")),
        "Expected runtime to return after setup",
      );
      assert(
        await exists(join(projectDir, "activate")),
        "Expected setup to regenerate activate",
      );
      assert(
        await exists(join(projectDir, "alteran.json")),
        "Expected authored project files to remain",
      );
    });
  },
});
