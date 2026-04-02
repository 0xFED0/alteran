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

- `projects/alteran/.specs/alteran_spec.md`
- `projects/alteran/docs/adr/0001-run-sources-vs-archive-sources.md`
- `projects/alteran/docs/adr/0002-linux-runtime-support-scope.md`
- related future ADRs under `projects/alteran/docs/adr/`

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

Tests should prefer local, self-hosted, deterministic inputs over public
network dependencies.

### 2.5 Honest platform scope

Supported behavior, unsupported behavior, and exploratory behavior must be
clearly separated.

If a platform is intentionally unsupported by product ADR, tests should reflect
that honestly.

## 3. Test Suite Goals

The Alteran suite exists to verify that:

- an Alteran project can be initialized correctly
- activation makes `deno` and `alteran` usable in the intended shell
- project-local runtime material is generated in the expected layout
- registry, config, and generated environment files stay coherent
- cleanup commands are safe and consistent with the specification
- bootstrap works from realistic source combinations
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
- small deterministic helpers that do not require shell or container orchestration

Current file:

- `projects/alteran/tests/alteran_unit_test.ts`

### 4.2 Repository-level e2e tests

These tests create temporary projects or repository copies and exercise Alteran
through real commands and generated files.

They should cover:

- `init`
- `ensure-env`
- `alteran test`
- `clean`
- activation in realistic shell contexts
- bootstrap from copied `activate`
- bootstrap from repository `activate`
- bootstrap from direct `deno run alteran.ts ...`
- hosted bootstrap via runnable and archive sources

Current file:

- `projects/alteran/tests/alteran_e2e_test.ts`

### 4.3 Windows-specific e2e tests

Windows behavior is sufficiently different that it must be tested explicitly.

These tests cover:

- `activate.bat`
- `cmd` session activation behavior
- `doskey` aliases
- PowerShell invocation patterns
- path quoting with spaces
- mirror-only local Deno bootstrap
- Windows architecture-specific runtime path behavior

Current file:

- `projects/alteran/tests/alteran_windows_e2e_test.ts`

These tests must be skipped on non-Windows hosts using explicit `ignore`
conditions rather than early `return`.

### 4.4 Docker e2e tests

Docker tests validate bootstrap and activation in minimal isolated Linux
environments.

They exist to validate:

- copied bootstrap scripts in empty targets
- repository activation from a mounted source tree
- direct `deno run alteran.ts init`
- direct `deno run alteran.ts ensure-env`
- behavior with and without globally available `deno`

Current file:

- `projects/alteran/tests/alteran_docker_e2e_test.ts`

## 5. Required User-Facing Scenarios

The suite should explicitly cover the following bootstrap/activation entrypaths.

### 5.1 Copied bootstrap scripts

The user copies `activate` and `activate.bat` into a target directory and runs
them there.

This is a first-class scenario because it represents bootstrap from an empty or
near-empty folder.

### 5.2 Direct activation script invocation with explicit target

The user runs repository `activate` and supplies a target directory.

This covers a common bootstrap flow from a checked-out Alteran source
repository.

### 5.3 Repository environment activation plus `alteran init`

The user enters an Alteran-capable repository environment and initializes some
other target directory through `alteran init`.

### 5.4 Direct `deno run alteran.ts ...`

The user bypasses shell activation and directly runs:

- `deno run alteran.ts init <target>`
- `deno run alteran.ts ensure-env <target>`

This must remain covered because it is a useful fallback and automation path.

### 5.5 Hosted bootstrap sources

The suite must cover bootstrap from:

- runnable sources
- archive sources

These should be hosted by test-local fixtures rather than public network
resources.

## 6. Platform Coverage Rules

### 6.1 Unix-like shells

Unix shell tests should exercise sourced activation semantics, especially cases
that can break shell state or path resolution.

Examples include:

- sourcing `./activate`
- sourcing absolute `activate` paths
- repeated activation
- shell option leakage

### 6.2 Windows

Windows tests should treat `.bat`, `cmd`, and PowerShell behavior as native
surfaces, not as approximations of Unix shell behavior.

The suite should continue to include:

- `call activate.bat`
- direct PowerShell `& activate.bat`
- PowerShell to `cmd /c call ...`
- spaces in repository and target paths
- legacy source env aliases where still supported

### 6.3 Linux in Docker

Docker coverage should focus on supported GNU-based Linux environments and on
bootstrap isolation.

Exploratory tests for unsupported Linux variants may exist, but their meaning
must stay clear and must not silently redefine product support.

The current support boundary for Linux is governed by ADR 0002.

## 7. Test Infrastructure Rules

### 7.1 Shared helpers are preferred

When multiple tests need the same setup or assertions, the shared logic should
move into helper modules under `projects/alteran/tests/`.

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

- `projects/alteran/tests/bootstrap_fixture.ts`

### 7.3 Docker fixture strategy

Docker bind-mounted temporary fixtures should live under repository-controlled
paths rather than host-specific system temp locations when required for
container runtime compatibility.

This avoids environment-specific mount failures and keeps Docker tests stable on
development setups such as Colima.

### 7.4 Ignore unsupported host conditions explicitly

If a test requires Windows or Docker availability, it should use `ignore`
metadata rather than pass as `ok (0ms)` by returning early.

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

### 8.3 Known open issues

If a test cannot be written correctly, or if the specification and product are
blocked by an unresolved contradiction, the problem should be documented under:

- `projects/alteran/tests/issues.md`

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
