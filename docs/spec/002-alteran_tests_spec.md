# Alteran Tests Specification

## 1. Purpose

This document defines the purpose, scope, structure, and operating rules of the
Alteran test suite.

It exists so that the test suite is guided by explicit product expectations
rather than by the current implementation alone.

The test suite must answer four questions:

- what behavior Alteran promises to users
- which scenarios are important enough to lock with tests
- how those scenarios should be tested
- how to interpret failures when the specification and implementation diverge

This document complements:

- `docs/spec/001-alteran_spec.md`
- `docs/adr/0001-run-sources-vs-archive-sources.md`
- `docs/adr/0002-linux-runtime-support-scope.md`
- related future ADRs under `docs/adr/`

## 2. Guiding Principles

### 2.1 Specification-first

Tests should follow the Alteran specification first.

If current code behaves differently from the specification, the test should
prefer the specification unless the specification is clearly ambiguous or
internally contradictory.

### 2.2 Signal over greenness

The goal is not to make all tests green at any cost.

The goal is to surface important user-facing breakage, especially in scenarios
that are:

- common
- plausible
- easy for a user to attempt
- dangerous when broken

If a test reproduces a realistic product bug, the test should remain strict
rather than being weakened to match the current bug.

### 2.3 User-centered scenarios

The suite should prioritize the user-facing bootstrap and activation flows of
Alteran rather than only internal implementation details.

### 2.4 Deterministic where possible

Tests should prefer local, self-hosted, deterministic inputs over public network
dependencies.

Repository and example test harnesses may rely on a small explicit host-tool
baseline when building deterministic local fixtures. On Unix-like hosts this
baseline currently includes:

- `curl`
- `git`
- `zip`
- `unzip` on Unix-like hosts
- `tar.exe` on Windows hosts

CI configuration
should install these tools explicitly instead of assuming they happen to be
present on the runner image. Tests that specifically require tracked-file
repository-copy behavior may be skipped when `git` is unavailable on a local
host.

Example validation should also prefer temp-copy-based workflows over mutating
committed `examples/` trees in place.

### 2.5 Honest platform scope

Supported behavior, unsupported behavior, and exploratory behavior must be
clearly separated.

If a platform is intentionally unsupported by product ADR, tests should reflect
that honestly.

### 2.6 Useful external-test observability

Repository-level end-to-end tests can fail in ways that are expensive to
reconstruct after the fact.

External test harnesses should therefore emit concise structured diagnostic
events when that helps explain:

- which scenario is running
- which fixture or temp-copy path was prepared
- which command or entrypath was chosen
- which important environment overrides were applied
- why a test was skipped or treated as harness-limited

This observability should improve failure triage without turning the suite into
verbose log spam.

## 3. Test Suite Goals

The Alteran suite exists to verify that:

- an Alteran project can be set up correctly
- activation makes `deno` and `alteran` usable in the intended shell
- project-local runtime material is generated in the expected layout
- registry, config, and generated activation files stay coherent
- cleanup commands are safe and consistent with the specification
- bootstrap works from realistic source combinations
- standalone app launchers can auto-materialize and launch a basic app flow
- Windows activation behavior is covered explicitly rather than inferred from
  Unix behavior
- Docker bootstrap paths are exercised in isolated environments

## 4. Test Categories

The suite is organized into four practical categories.

### 4.1 Unit tests

Unit tests validate pure or mostly isolated logic in Alteran modules.

These tests should cover:

- config generation and synchronization
- source-list parsing and precedence
- `.env` loading and source-root resolution
- environment template rendering
- small deterministic helpers that do not require shell or container
  orchestration

Current file:

- `tests/alteran_unit_test.ts`

### 4.2 Repository-level e2e tests

These tests create temporary projects or repository copies and exercise Alteran
through real commands and generated files.

They should cover:

- `setup`
- `alteran test`
- `clean`
- activation in realistic shell contexts
- bootstrap from copied `setup`
- bootstrap from repository `setup`
- bootstrap from direct `deno run alteran.ts ...`
- hosted bootstrap via runnable and archive sources
- generated app launcher execution for a minimal standalone app scenario

Current file:

- `tests/alteran_e2e_test.ts`

This file should keep only cross-platform repository e2e scenarios that are
expected to behave the same on Unix and Windows.

### 4.3 Unix-specific e2e tests

Unix shell behavior is sufficiently different that it must be tested explicitly
in a separate suite.

These tests cover:

- sourced `activate`
- shell alias behavior in `sh`/`zsh`
- Unix launcher execution semantics
- copied `setup` bootstrap flows that are exercised through Unix shells
- Unix direct cleanup and compact behavior without Windows-specific handoff

Current file:

- `tests/alteran_unix_e2e_test.ts`

These tests must be skipped on Windows hosts using explicit `ignore` conditions
rather than early `return`.

### 4.4 Windows-specific e2e tests

Windows behavior is sufficiently different that it must be tested explicitly.

These tests cover:

- `activate.bat`
- `activate.ps1`
- `cmd` session activation behavior
- `doskey` aliases
- PowerShell invocation patterns
- path quoting with spaces
- mirror-only local Deno bootstrap
- Windows architecture-specific runtime path behavior

Current file:

- `tests/alteran_windows_e2e_test.ts`

These tests must be skipped on non-Windows hosts using explicit `ignore`
conditions rather than early `return`.

### 4.5 Docker e2e tests

Docker tests validate bootstrap and activation in minimal isolated Linux
environments.

They exist to validate:

- copied bootstrap scripts in empty targets
- repository activation from a mounted source tree
- direct `deno run alteran.ts setup`
- behavior with and without globally available `deno`

Current file:

- `tests/alteran_docker_e2e_test.ts`

### 4.6 Examples and docs validation

Repository-level examples and docs validation protect executable documentation.

These tests cover:

- example smoke scenarios
- example scenario assertions
- README quick start validation
- invocation of example-local internal tests for self-testable examples

Current files:

- `tests/examples/*.ts`
- `tests/docs/readme_quickstart_test.ts`

Current task:

- `deno task test:examples`

## 5. Required User-Facing Scenarios

The suite should explicitly cover the following bootstrap/activation entrypaths.

### 5.1 Copied bootstrap scripts

The user copies `setup` and `setup.bat` into a target directory and runs them
there.

This is a first-class scenario because it represents bootstrap from an empty or
near-empty folder.

### 5.2 Direct setup script invocation with explicit target

The user runs repository `setup` and supplies a target directory.

This covers a common bootstrap flow from a checked-out Alteran source
repository.

### 5.3 Repository environment activation plus `alteran setup`

The user enters an Alteran-capable repository environment and sets up some other
target directory through `alteran setup`.

### 5.4 Direct `deno run alteran.ts ...`

The user bypasses shell activation and directly runs:

- `deno run alteran.ts setup <target>`

This must remain covered because it is a useful fallback and automation path.

### 5.5 Hosted bootstrap sources

The suite must cover bootstrap from:

- runnable sources
- archive sources

These should be hosted by test-local fixtures rather than public network
resources.

### 5.6 Generated Unix activation semantics

The suite must cover generated Unix `activate` behavior as a sourced-only
artifact.

This includes:

- `source ./activate`
- activation from the generated file after `setup`
- explicit failure when `activate` is run as a regular process

### 5.7 Basic standalone app launcher contract

The suite must cover a minimal generated `app` / `app.bat` launcher scenario.

At minimum, the contract test should verify:

- a basic app launcher can be executed directly by the user
- no `source app` style flow is required or supported
- if the app-local runtime is missing, launcher-triggered setup/bootstrap can
  materialize enough runtime to proceed
- the launcher then runs the main app task successfully
- a later launch can reuse the already materialized app-local runtime
- the launcher rejects a mismatched `app.json` identity instead of silently
  treating a different app directory as valid

### 5.8 Example self-tests for mini-project examples

For examples that meaningfully behave like small self-contained Alteran
projects, the suite should also verify that the example's own local test entry
path remains runnable after the example is prepared.

In the current repository, this means:

- internal tests may live under `examples/<path>/tests/`
- repository-level tests still make their own outer assertions
- repository-level tests also invoke the example's local internal test command
  from inside the prepared temp-copy example context

Bootstrap-oriented examples are not required to gain this layer.

## 6. Platform Coverage Rules

### 6.1 Unix-like shells

Unix shell tests should exercise sourced activation semantics, especially cases
that can break shell state or path resolution.

Examples include:

- sourcing `./activate`
- sourcing absolute `activate` paths
- repeated activation
- shell option leakage
- failure when `./activate` is executed instead of sourced

### 6.2 Windows

Windows tests should treat `.bat`, `cmd`, and PowerShell behavior as native
surfaces, not as approximations of Unix shell behavior.

The suite should continue to include:

- `call activate.bat`
- direct PowerShell `& setup.bat`
- dot-sourced PowerShell `. .\activate.ps1`
- PowerShell to `cmd /c call ...`
- spaces in repository and target paths
- legacy source env aliases where still supported
- direct execution of generated `app.bat` launchers for supported standalone app
  scenarios

## 7. Repository Task Model

The repository should expose explicit top-level tasks for the main suite slices.

Current expected tasks include:

- `test:unit`
- `test:e2e`
- `test:examples`
- `test:windows`
- `test:docker`
- `test`

`test` should act as an orchestrated aggregate entrypoint rather than relying on
an unconstrained root-level `deno test -A` over the whole repository tree.

### 6.3 Linux in Docker

Docker coverage should focus on supported GNU-based Linux environments and on
bootstrap isolation.

Exploratory tests for unsupported Linux variants may exist, but their meaning
must stay clear and must not silently redefine product support.

The current support boundary for Linux is governed by ADR 0002.

## 7. Test Infrastructure Rules

### 7.1 Shared helpers are preferred

When multiple tests need the same setup or assertions, the shared logic should
move into helper modules under `tests/`.

Examples include:

- bootstrap fixture preparation
- local HTTP serving
- temporary repository copies
- shell runners
- Windows command helpers

### 7.2 Hosted fixture strategy

Remote bootstrap tests should use self-hosted local fixtures that expose:

- a runnable source bundle
- an archive source bundle

This keeps tests deterministic and allows controlled reproduction of bootstrap
behavior.

Current helper:

- `tests/bootstrap_fixture.ts`

### 7.3 Docker fixture strategy

Docker bind-mounted temporary fixtures should live under repository-controlled
paths rather than host-specific system temp locations when required for
container runtime compatibility.

This avoids environment-specific mount failures and keeps Docker tests stable on
development setups such as Colima.

### 7.4 Ignore unsupported host conditions explicitly

If a test requires Windows or Docker availability, it should use `ignore`
metadata rather than pass as `ok (0ms)` by returning early.

### 7.5 Repository examples are not scratch workspaces

Tests must not rely on the committed `examples/` directories as their normal
scratch workspace.

When a test needs to exercise an example through `setup`, `activate`, `refresh`,
`compact`, or launcher flows, it should prefer a hermetic temp directory derived
from that example rather than mutating the committed example directory itself.

### 7.6 Deferred cleanup handoff must be tested as part of final command semantics

When Windows `clean`, `compact`, or direct `alteran deno clean` flows rely on the narrow temp cleanup batch handoff, tests must treat the entire launcher cycle as the user-visible command boundary.

This means tests should verify:

- the final exit code after the wrapper and any deferred cleanup batch;
- the actual resulting filesystem state after the full command cycle;
- direct interception of `alteran deno clean` / `adeno clean` where relevant;
- use of deferred handoff only for the runtime-sensitive Windows cases that require it;
- absence of that handoff for direct-scope cleanup such as `builds`, `logs`, `env`, and `app-runtimes`.

Tests must not treat an in-process TypeScript success return as sufficient if a deferred Windows cleanup batch is part of the command contract.

### 7.7 External harness tracing should be structured and selective

Repository-level e2e, Unix, Windows, Docker, examples, and docs harnesses may
use structured logging to enrich `events.jsonl` and similar diagnostic streams.

That tracing should focus on useful breadcrumbs such as:

- prepared temp directories or repo copies;
- selected bootstrap source mode;
- fixture server startup or shutdown;
- actual command entrypaths under test;
- important environment overrides;
- explicit skip reasons;
- file-system expectations before or after a destructive step.

Current repository conventions should keep these traces under the
`["alteran", "tests", ...]` category tree, with stable slices such as:

- `["alteran", "tests", "unit"]`
- `["alteran", "tests", "e2e", "repo"]`
- `["alteran", "tests", "e2e", "repo", "unix"]`
- `["alteran", "tests", "e2e", "repo", "windows"]`
- `["alteran", "tests", "e2e", "docker"]`
- `["alteran", "tests", "e2e", "examples", "harness"]`
- `["alteran", "tests", "e2e", "harness", ...]` for shared outer helpers

Such tracing should not:

- duplicate complete stdout/stderr payloads that are already captured elsewhere;
- add noisy per-line command echoing without diagnostic value;
- be required for pure unit tests;
- force extra logging dependencies into example-internal tests.

By default this extra tracing should remain file-oriented and should enrich
`events.jsonl` rather than mirroring additional noise to stdout/stderr.

When a repository-level test intentionally simulates a foreign
`ALTERAN_ROOT_LOG_DIR` or similar rebased log context, outer test breadcrumbs
should still stay scoped under the current top-level test run directory. They
should therefore prefer a nested path such as:

- `.runtime/logs/tests/<run-id>/foreign-root/events.jsonl`

rather than writing directly into a reused global location such as:

- `.runtime/logs/tests/foreign-root/events.jsonl`

## 8. Failure Interpretation Rules

### 8.1 Product bug

A failure should be treated as a product bug when:

- the scenario is aligned with the specification
- the setup is realistic
- the fixture is valid
- the failure happens after bootstrap/setup has succeeded enough to exercise the
  intended behavior

### 8.2 Test harness bug

A failure should be treated as test-infrastructure breakage when:

- the fixture itself is malformed
- path mapping or bind mounting is wrong
- a local test server serves the wrong content or content type
- the test injects contradictory environment assumptions

Harness bugs should be fixed so that the suite reveals product behavior more
accurately.

When structured harness tracing exists, failure interpretation should prefer
those breadcrumbs before making assumptions from sparse stdout/stderr alone.

### 8.3 Known open issues

If a test cannot be written correctly, or if the specification and product are
blocked by an unresolved contradiction, the problem should be documented under:

- `tests/issues.md`

The rest of the suite should continue moving forward.

## 9. Current Task Mapping

The repository should expose dedicated tasks for major test categories.

Expected tasks:

- `test:unit`
- `test:e2e`
- `test:windows`
- `test:docker`
- `test`

These tasks are part of the expected developer workflow and should stay in sync
with the actual test file layout.

## 10. Non-Goals

The test suite does not need to exhaustively enumerate every theoretical shell,
container, or path combination.

It should instead optimize for:

- high-value user scenarios
- combinations of factors likely to reveal hidden breakage
- regressions in bootstrap, activation, and runtime materialization

## 11. Maintenance Guidance

When adding tests:

- prefer adding or extending shared helpers instead of duplicating setup logic
- keep scenario names specific and user-facing
- preserve failing tests that reveal real breakage
- document blockers instead of silently weakening coverage
- update this specification when the suite’s strategy or platform scope changes
