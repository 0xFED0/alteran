import {
  assert,
  assertSuccess,
  copyExampleToTemp,
  decode,
  latestLogDir,
  readJson,
  REQUIRES_LOCAL_DENO_FIXTURE,
  runExampleActivated,
  runExampleInternalTests,
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
    "logging run tree internal tests stay runnable through alteran test",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("05-logging-run-tree");
    await withLocalDenoSources(async (env) => {
      const output = await runExampleInternalTests(projectDir, env);
      assertSuccess(output, "logging run tree internal tests");
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
      const events = await Deno.readTextFile(`${parentDir}/events.jsonl`);

      assert(
        events.includes('"msg":"run started"') &&
          events.includes('"parent_run_id":"' + parentMetadata.run_id + '"'),
        "Expected root events to record a child run linked to the parent run id",
      );
    });
  },
});
