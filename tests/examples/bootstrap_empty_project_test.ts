import { join } from "node:path";

import { exists } from "../../src/alteran/fs.ts";
import {
  assert,
  assertSuccess,
  copyExampleToTemp,
  REQUIRES_LOCAL_DENO_FIXTURE,
  runExampleActivated,
  runExampleSetup,
  withLocalDenoSources,
} from "./_example_test_utils.ts";

Deno.test({
  name:
    "bootstrap empty folder smoke: local setup and generated activate make the example usable",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("01-bootstrap-empty-folder");
    await withLocalDenoSources(async (env) => {
      const output = await runExampleActivated(
        projectDir,
        "alteran help >/dev/null",
        env,
      );

      assertSuccess(output, "bootstrap empty folder activation");
    });
  },
});

Deno.test({
  name:
    "bootstrap empty folder scenario: setup creates the managed project layout without .runtime/env",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("01-bootstrap-empty-folder");
    await withLocalDenoSources(async (env) => {
      const setup = await runExampleSetup(projectDir, env);
      assertSuccess(setup, "bootstrap empty folder setup");

      for (
        const relativePath of [
          ".gitignore",
          "setup",
          "setup.bat",
          "activate",
          "activate.bat",
          "alteran.json",
          "deno.json",
          ".runtime/alteran/mod.ts",
          "apps",
          "tools",
          "libs",
          "tests",
        ]
      ) {
        assert(
          await exists(join(projectDir, relativePath)),
          `Expected ${relativePath} to exist after setup`,
        );
      }

      assert(
        !(await exists(join(projectDir, ".runtime", "env"))),
        "Expected setup/activate architecture not to persist .runtime/env",
      );
    });
  },
});
