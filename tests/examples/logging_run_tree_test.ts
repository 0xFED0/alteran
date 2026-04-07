import { exists } from "../../src/alteran/fs.ts";
import {
  assert,
  assertSuccess,
  copyExampleToTemp,
  decode,
  latestLogDir,
  readJson,
  REQUIRES_LOCAL_DENO_FIXTURE,
  runExampleActivated,
  withLocalDenoSources,
} from "./_example_test_utils.ts";

Deno.test({
  name:
    "logging run tree smoke: the documented tool flow captures parent and child output",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("05-logging-run-tree");
    await withLocalDenoSources(async (env) => {
      const output = await runExampleActivated(
        projectDir,
        "alteran tool run run-pipeline alpha beta",
        env,
      );

      assertSuccess(output, "run-pipeline tool");

      const stdout = decode(output.stdout);
      const stderr = decode(output.stderr);
      assert(
        stdout.includes("parent stdout alpha,beta"),
        "Expected parent stdout marker",
      );
      assert(
        stdout.includes("child stdout alpha,beta"),
        "Expected child stdout marker",
      );
      assert(
        stderr.includes("parent stderr marker"),
        "Expected parent stderr marker",
      );
      assert(
        stderr.includes("child stderr marker"),
        "Expected child stderr marker",
      );
    });
  },
});

Deno.test({
  name:
    "logging run tree scenario: child invocation stays linked to the parent run",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("05-logging-run-tree");
    await withLocalDenoSources(async (env) => {
      const output = await runExampleActivated(
        projectDir,
        "alteran tool run run-pipeline nested",
        env,
      );

      assertSuccess(output, "run-pipeline nested");

      const parentDir = await latestLogDir(projectDir, "tools");
      const parentMetadata = await readJson(`${parentDir}/metadata.json`) as {
        run_id: string;
      };

      const hasNestedRunDir = await exists(`${projectDir}/.runtime/logs/runs`);
      assert(hasNestedRunDir, "Expected nested run logs to be present");

      const childDir = await latestLogDir(projectDir, "runs");
      const childMetadata = await readJson(`${childDir}/metadata.json`) as {
        parent_run_id: string | null;
      };

      assert(
        childMetadata.parent_run_id === parentMetadata.run_id,
        "Expected child run metadata to point at the parent run id",
      );
    });
  },
});
