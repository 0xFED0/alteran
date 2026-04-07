# Testing, Examples, And Regression Discipline

## Prefer Signal Over Artificial Greenness

- Tests should reveal product bugs, not hide them.
- If something is intentionally unsupported, encode that honestly.
- Platform caveats belong in the matrix, docs, and assertions.

## Test Through Real User Flows

High-value flows include:

- bootstrap from copied `setup`
- repository-local `setup`
- `source ./activate`
- generated app launcher behavior
- standalone app first-run bootstrap
- managed execution under `alteran test`, not only plain `deno test`

## Hermeticity Matters More Than It Looks

The easiest things to leak are:

- `ALTERAN_HOME`
- root/logging env vars
- bootstrap source env vars
- inherited working directory assumptions

If a test spawns another Alteran project, scrub foreign context first unless
inheritance is the thing being tested.

## Prefer Deterministic Local Fixtures

- Prefer self-hosted local fixtures for bootstrap/archive tests.
- Avoid external infrastructure in ordinary test flows.
- Be explicit about harness prerequisites such as shells, zip tools, loopback
  binding, and local Deno availability.

## Examples Are Contracts, Not Decorations

- Examples are part of the public story.
- If an example looks supported, it should be runnable, documented honestly,
  and exercised by tests.
- Example tests should prove the specific teaching point of the example, not
  just "command exited 0".

## Docs Flows Are Product Flows

- README quick-start and copied-project flows are product surfaces.
- A docs test that only passes because the repository is warmed up is lying.
- Prefer normalized repository snapshots over dirty working-copy mirroring.

## Reproduce First, Then Generalize

When a bug appears:

1. capture the smallest honest repro
2. add or improve the test around that repro
3. only then refactor helper-level coverage if useful

## Do Not Stop At The First Green Check

After touching high-leverage surfaces such as setup, activation, runtime
materialization, generated scripts, examples, or docs, rerun more than the
narrow failing test.

At minimum, revisit:

- the original repro
- relevant unit coverage
- repository e2e coverage
- examples tests
- docs quick-start tests

## Practical Smells

- tests pass under plain Deno but fail under Alteran
- example tests write logs into the repo instead of the temp project
- harness compensates for the bug instead of exposing it
- tests return early and still look like success
- a regression was "fixed" by weakening the assertion until it stopped proving
  anything

## Related Source Of Truth

- [ADR 0003](../../adr/0003-test-suite-prioritizes-signal-over-greenness.md)
- [ADR 0004](../../adr/0004-self-hosted-bootstrap-fixtures-for-e2e.md)
- [Testing](../testing.md)
- [Test Spec](../../spec/002-alteran_tests_spec.md)
- [Examples Test Spec](../../spec/004-alteran_examples_test_spec.md)
