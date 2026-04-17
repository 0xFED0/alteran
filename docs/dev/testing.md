# Testing

Alteran testing is guided by product specs, examples specs, and ADRs rather than
implementation convenience alone.

## Main Test Categories

- unit tests
- repository-level end-to-end tests
- Unix-specific end-to-end tests
- Windows-specific end-to-end tests
- Docker end-to-end tests
- examples tests
- docs quick start tests

## Repository Tasks

Expected developer tasks include:

- `test:unit`
- `test:e2e`
- `test:examples`
- `test:windows`
- `test:docker`
- `test`

## Testing Principles

- specification-first behavior
- signal over greenness
- user-centered scenarios
- deterministic fixtures where practical
- honest platform scope
- hermetic execution context
- docs and examples treated as product surfaces

## Important Coverage Areas

- bootstrap from empty or copied setup files
- activation behavior on Unix and Windows
- runtime materialization
- refresh and config synchronization
- standalone app launcher contract
- examples as executable documentation
- project-scoped logging and managed execution boundaries
- Windows deferred cleanup handoff semantics through the real wrapper cycle

## Execution Guidance

When testing high-leverage product flows, prefer exercising them through Alteran
entrypoints rather than only through plain `deno test`. This helps catch
project-context, logging, and managed-execution regressions that plain Deno runs
may miss.

For cleanup-sensitive commands such as `clean` and `compact`, treat the launcher
wrapper and any Windows deferred cleanup batch as part of the product behavior.
Tests should therefore prefer activated-shell or generated-launcher paths when
validating final cleanup semantics, and they should assert the resulting
filesystem state after the whole command cycle rather than trusting a zero exit
code alone.

For repository examples, prefer this discipline:

1. normalize committed examples through `deno run -A ./examples/reset.ts` when
   needed;
2. prepare hermetic temp copies for execution; project examples should
   preferably be copied through `alteran compact-copy`, not through an ad hoc
   raw directory copy;
3. avoid using committed `examples/` directories as in-place scratch workspaces
   during normal validation.

For day-to-day repository maintenance, prefer the orchestrated surface:

- `alteran tool run examples test`
- `alteran tool run examples reset ...`

instead of ad hoc loops over `examples/`.

For self-testable mini-project examples, repository-level validation should also
invoke the example's own local internal tests after setup. In the current
repository that inner command model is `deno test -A` from inside the prepared
example copy, while the outer repository test still keeps its own assertions.

For external repository-level tests, it is acceptable and encouraged to add a
small amount of structured harness logging when it materially improves failure
triage. The goal is not "more logs", but better breadcrumbs in `events.jsonl`
for questions such as:

- which temp project or repo copy was created;
- which bootstrap mode or fixture URL was selected;
- which command entrypath actually ran;
- which env overrides mattered;
- why a test was skipped.

Keep this selective. Do not duplicate full stdout/stderr streams, and do not
push extra logging dependencies into example-internal tests just to satisfy
repository-level observability.

Current trace categories should follow a stable hierarchy rooted at:

- `["alteran", "tests", "unit"]`
- `["alteran", "tests", "e2e", "repo"]`
- `["alteran", "tests", "e2e", "repo", "unix"]`
- `["alteran", "tests", "e2e", "repo", "windows"]`
- `["alteran", "tests", "e2e", "docker"]`
- `["alteran", "tests", "e2e", "examples", "harness"]`
- `["alteran", "tests", "e2e", "harness", ...]` for shared outer helpers

These test traces should rely on Alteran's file-oriented events sink, so they
enrich `events.jsonl` without adding extra console noise during normal test
runs.

When a test intentionally rebases execution into a foreign root-log context,
outer test breadcrumbs should still remain scoped under the current test run's
own log tree rather than flowing into a long-lived shared path. In practice,
that means breadcrumbs should prefer a nested path such as:

- `.runtime/logs/tests/<run-id>/foreign-root/events.jsonl`

instead of writing directly into a reused global location like:

- `.runtime/logs/tests/foreign-root/events.jsonl`

## CI Expectations

Repository automation should cover the main supported test surfaces rather than
only a single smoke suite.

Repository CI and release workflows should also keep entry-surface discipline:

- do not treat `deno run -A ./alteran.ts ...` from a bare checkout as a normal
  replacement for an initialized project runtime;
- if the workflow needs managed Alteran routes such as `tool run`, `task`,
  preinit, logging, or generated wrappers, prepare the repository first through
  `setup` or `refresh`;
- after that, execute through the prepared local project runtime / generated
  project surfaces rather than pretending authored source alone is the steady
  execution contract.

For publication workflow debugging, repository automation may also expose a
manual dry-run path that exercises the same preparation and staging logic
without performing the final external publish or release mutation. In that
mode, prepared publication outputs should be preserved as workflow artifacts so
maintainers can inspect the staged payload directly.

At minimum, CI should include:

- `deno check` for Alteran source, tools, and test files
- unit tests
- repository e2e tests
- docs/examples tests
- docker e2e tests on Linux
- Windows e2e tests on Windows

On Unix-like hosts, the repository test harness assumes these system tools are
available:

- `curl`
- `unzip`
- `zip`
- `git`

`curl` and `unzip` are required for bootstrap paths that materialize a local
Deno runtime. `zip` is required by local archive-fixture flows used by
repository e2e and example tests. `git` is required by repository-copy
documentation scenarios that intentionally operate on tracked files only. Linux
CI should install these explicitly rather than relying on runner defaults. When
`git` is unavailable locally, tests that require tracked-file repository copies
should be skipped rather than rewritten to depend on an ad hoc filesystem copy.

Git-based repository-copy tests also assume that the checkout is considered safe
by the host `git`. Docker bind mounts with mismatched ownership can trigger
Git's `dubious ownership` protection; in that case Alteran should skip those
repo-copy tests locally rather than mutating the user's global `safe.directory`
policy. CI should run them from a normal checkout or copy.

In the current repository layout, GitHub Actions workflow files live under
`.github/workflows/` at the Alteran repository root and target `.`.

## Related Source

- [Test spec](../spec/002-alteran_tests_spec.md)
- [Examples test spec](../spec/004-alteran_examples_test_spec.md)

## Navigation

- Home: [Docs Index](../README.md)
- Previous: [Logging](./logging.md)
- Next: [Publication](./publication.md)
