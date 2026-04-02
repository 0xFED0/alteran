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
    "managed vs plain smoke: the README flow shows plain and managed execution as different modes",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("04-managed-vs-plain-deno");
    await withLocalDenoSources(async (env) => {
      const plain = await runExampleActivated(
        projectDir,
        "deno run -A ./tools/context-probe.ts",
        env,
      );
      const managed = await runExampleActivated(
        projectDir,
        "alteran tool run context-probe",
        env,
      );

      assertSuccess(plain, "plain deno context probe");
      assertSuccess(managed, "managed context probe");

      assert(
        decode(plain.stdout).includes("managed=no"),
        "Expected plain run to report managed=no",
      );
      assert(
        decode(managed.stdout).includes("managed=yes"),
        "Expected managed run to report managed=yes",
      );
    });
  },
});

Deno.test({
  name:
    "managed vs plain scenario: managed execution creates a logged tool invocation",
  ignore: !REQUIRES_LOCAL_DENO_FIXTURE,
  async fn() {
    const projectDir = await copyExampleToTemp("04-managed-vs-plain-deno");
    await withLocalDenoSources(async (env) => {
      const managed = await runExampleActivated(
        projectDir,
        "alteran tool run context-probe",
        env,
      );

      assertSuccess(managed, "managed probe logging");

      const logDir = await latestLogDir(projectDir, "tools");
      const metadata = await readJson(`${logDir}/metadata.json`) as {
        name: string;
        run_id: string;
      };

      assert(
        metadata.name === "context-probe",
        "Expected tool metadata for context-probe",
      );
      assert(
        decode(managed.stdout).includes(`run_id=${metadata.run_id}`),
        "Expected stdout to expose the same run id stored in metadata",
      );
    });
  },
});
