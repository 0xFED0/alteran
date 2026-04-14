import {
  assert,
  assertSuccess,
  copyExampleToTemp,
  decode,
  REQUIRES_LOCAL_DENO_FIXTURE,
  runExampleActivated,
  runExampleInternalTests,
  withLocalDenoSources,
} from "./_example_test_utils.ts";

Deno.test({
  name:
    "tools workspace smoke: the documented setup and activation flow runs the example tools",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("03-tools-workspace");
    await withLocalDenoSources(async (env) => {
      const output = await runExampleActivated(
        projectDir,
        "alteran tool run check-env && alteran tool run release-notes 0.2.0 added-managed-tools simplified-ops",
        env,
      );

      assertSuccess(output, "tools workspace smoke");

      const stdout = decode(output.stdout);
      assert(
        stdout.includes("alteran_home: "),
        "Expected check-env to print managed environment details",
      );
      assert(
        stdout.includes("release 0.2.0"),
        "Expected release-notes to print the requested release header",
      );
    });
  },
});

Deno.test({
  name: "tools workspace internal tests stay runnable through alteran test",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("03-tools-workspace");
    await withLocalDenoSources(async (env) => {
      const output = await runExampleInternalTests(projectDir, env);
      assertSuccess(output, "tools workspace internal tests");
    });
  },
});

Deno.test({
  name:
    "tools workspace scenario: shared formatting code remains visible in tool output",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("03-tools-workspace");
    await withLocalDenoSources(async (env) => {
      const output = await runExampleActivated(
        projectDir,
        "alteran tool run release-notes 0.3.0 added fixed",
        env,
      );

      assertSuccess(output, "release-notes formatting");

      const stdout = decode(output.stdout);
      assert(
        stdout.includes("item_1: added") && stdout.includes("item_2: fixed"),
        "Expected release-notes to render rows through the shared table helper",
      );
    });
  },
});
