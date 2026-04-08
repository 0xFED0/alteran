import { join } from "node:path";

import { exists } from "../../src/alteran/fs.ts";
import {
  assert,
  assertSuccess,
  prepareRepoCopy,
  REQUIRES_GIT_REPO_COPY,
  REQUIRES_LOCAL_DENO_FIXTURE,
  runShell,
  withLocalDenoSources,
} from "../examples/_example_test_utils.ts";

Deno.test({
  name: "README quick start stays runnable from a clean repository copy",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE || !REQUIRES_GIT_REPO_COPY,
  async fn() {
    const repoDir = await prepareRepoCopy();
    const appLogPath = await Deno.makeTempFile({
      prefix: "alteran-readme-app-",
    });
    const toolLogPath = await Deno.makeTempFile({
      prefix: "alteran-readme-tool-",
    });
    await withLocalDenoSources(async (env) => {
      const output = await runShell(
        `cd ${
          JSON.stringify(repoDir)
        } && ./setup >/dev/null && . ./activate >/dev/null && alteran app add hello >/dev/null && alteran tool add seed >/dev/null && alteran app run hello >${
          JSON.stringify(appLogPath)
        } && alteran tool run seed >${JSON.stringify(toolLogPath)}`,
        env,
      );

      assertSuccess(output, "README quick start");

      const appOutput = await Deno.readTextFile(appLogPath);
      const toolOutput = await Deno.readTextFile(toolLogPath);
      assert(
        appOutput.includes("App hello started"),
        `Expected hello app output, got: ${appOutput}`,
      );
      assert(
        toolOutput.includes("Tool seed started"),
        `Expected seed tool output, got: ${toolOutput}`,
      );
      assert(
        await exists(join(repoDir, "activate")),
        "Expected quick start setup to generate activate",
      );
      assert(
        await exists(join(repoDir, "apps", "hello", "core", "mod.ts")),
        "Expected quick start to scaffold the hello app",
      );
      assert(
        await exists(join(repoDir, "tools", "seed.ts")),
        "Expected quick start to scaffold the seed tool entry",
      );
      assert(
        !(await exists(join(repoDir, ".runtime", "env"))),
        "Expected quick start not to rely on persisted .runtime/env scripts",
      );
    });
  },
});
