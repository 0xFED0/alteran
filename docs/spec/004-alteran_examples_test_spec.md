# Alteran Examples Testing Specification

## 1. Purpose

This document defines the testing policy for the `examples/` area in the Alteran repository.

Its purpose is to ensure that Alteran examples remain:

- runnable;
- truthful;
- aligned with current behavior;
- safe from silent regressions;
- useful as executable documentation.

Examples in Alteran are not decorative repository content. They are part of the product-facing documentation surface and help communicate real capabilities, real project structure, and real usage flows.

This document defines what must be tested, what must not be over-tested, how example tests should be categorized, and how example validation relates to documentation and README quick start flows.

Internal example self-tests are governed additionally by:

- `docs/spec/008-alteran_examples_internal_tests_spec.md`

---

## 2. Why Example Testing Is Required

Alteran examples must be tested because they are intended to demonstrate real supported usage patterns rather than static illustrations.

If examples are not validated automatically, they can drift away from the actual product behavior and become misleading.

This is especially important in Alteran because:

- `examples/` is a first-class repository area for example Alteran projects and example use cases;
- `tests/` is a first-class top-level project category rather than an optional afterthought;
- README quick start and user documentation are expected to demonstrate real runnable flows;
- Alteran includes bootstrap, initialization, refresh, runtime, and layout synchronization behavior that is especially vulnerable to accidental breakage during refactoring.

The intended rule is:

**examples are executable documentation, and executable documentation must be executed in tests.**

Those tests should execute examples in hermetic temp copies rather than by using the committed `examples/` directories as the primary scratch workspace.

---

## 3. Scope

This document applies to:

- example projects under `examples/`;
- example flows referenced by user documentation;
- example flows represented in README quick start when those flows are backed by example scenarios;
- automated tests that validate example correctness.

This document does not require every example to be tested like a production application with exhaustive internal unit coverage.

The purpose is to validate supported user-facing scenarios, not to duplicate the entire implementation test suite inside examples.

---

## 4. Core Policy

Alteran must treat examples as supported runnable scenarios.

Therefore:

1. every maintained example must have automated validation;
2. every maintained example must pass at least a smoke test;
3. key examples must additionally have scenario-level validation;
4. README quick start must be validated separately as a documentation-backed runnable flow;
5. examples that are no longer maintained must either be repaired, downgraded in support status, or removed.

An example must never remain in the repository in a supported-looking state while being known to be broken.

---

## 5. Testing Levels

Example testing must be divided into levels.

## 5.1. Smoke tests

Every maintained example must have at least a smoke test.

The purpose of a smoke test is to verify that the example is still alive as a supported runnable scenario.

A smoke test should usually verify that:

- the example can be initialized, opened, or prepared in its intended way;
- the documented entry command can be executed successfully;
- the process exits successfully;
- the output contains a small expected success marker or equivalent evidence of correct execution.

Smoke tests should remain lightweight and fast.

They should answer the question:

**Does this example still work at all?**

## 5.2. Scenario tests

Important examples must have scenario tests in addition to smoke tests.

Scenario tests validate a fuller supported user flow.

Depending on the example, a scenario test may verify things such as:

- bootstrap from an empty directory;
- `setup` behavior;
- `refresh` behavior;
- app creation and execution;
- tool creation and execution;
- workspace or config synchronization;
- expected generated files;
- expected directory structure after commands;
- expected logging structure;
- expected compact/cleanup results.

Scenario tests should answer the question:

**Does the full intended user scenario still behave as promised?**

For standalone-app-oriented examples, scenario validation should include the launcher contract itself, for example:

- launching `app` / `app.bat` directly rather than through sourced shell setup;
- first launch with missing app-local runtime material;
- automatic app-local setup/bootstrap triggered by the launcher;
- successful later launch with the already materialized app-local runtime.

## 5.3. Contract tests

Examples may also be validated through contract-style assertions when they are intended to demonstrate a specific invariant or supported contract.

Examples of suitable contract checks include:

- an expected generated config key exists;
- an expected import alias is present;
- an expected log file is created;
- a specific user-visible command route continues to work;
- a known supported structure appears after initialization.

Contract tests are appropriate when the example exists to demonstrate a specific guarantee rather than only a generic runnable workflow.

---

## 6. Minimum Testing Requirement Per Example

Every maintained example must satisfy the following minimum requirement:

- it has at least one automated smoke test;
- that test is part of the repository test suite;
- that test is expected to pass in normal supported development and CI flows.

No maintained example should exist without at least this minimal protection.

---

## 7. Which Examples Require Scenario Tests

Scenario tests are required for examples that demonstrate core Alteran value or non-trivial supported behavior.

This includes, at minimum, examples such as:

- bootstrap from empty folder;
- multi-app workspace;
- tools workspace;
- managed execution vs plain Deno;
- logging and run-tree behavior;
- refresh or reimport flows;
- compact or transfer-ready flows.

Examples that exist to teach bootstrap-first state, such as `01-bootstrap-empty-folder`, especially must be protected from in-place mutation during test preparation.

If an example exists primarily to prove or teach a central Alteran capability, it must not rely on smoke coverage alone.

---

## 8. README Quick Start Testing Requirement

README Quick Start must have explicit automated validation.

This is required because the README front page is part of the public product contract.

If the quick start is wrong, the repository misleads users at the exact point of first contact.

The quick start test should verify that the documented flow remains runnable and accurate.

At minimum, that validation should cover:

- project directory creation assumptions;
- one-line initialization by URL or equivalent public bootstrap path;
- app creation;
- tool creation;
- minimal runnable code placement assumptions where relevant;
- app execution;
- tool execution.

README quick start validation may be implemented directly or derived from a dedicated example-backed scenario, but it must be explicit and intentional.

---

## 9. What Example Tests Must Not Become

Example tests must not turn the `examples/` area into a duplicate product test matrix.

In general, example testing should not require:

- deep unit testing of every internal line of example code;
- complete duplication of Alteran's main integration test suite;
- overly brittle exact-output assertions when smaller semantic markers are sufficient;
- heavy, complex, or difficult-to-maintain infrastructure for trivial examples.

Examples should remain understandable demonstrations, not secondary production systems.

The purpose is to validate example truthfulness and support status, not to maximize raw test volume.

---

## 10. Relationship to Main Test Suite

Example tests are part of the main repository testing strategy, but they have a distinct purpose.

The main Alteran test suite validates Alteran behavior broadly.

Example tests validate that repository examples still correctly demonstrate supported user-facing scenarios.

Therefore, example tests should complement the main test suite rather than duplicate it.

A good example test typically checks:

- that a promised scenario still works;
- that the example still matches documentation intent;
- that user-visible behavior remains aligned with what the repository presents.

---

## 11. Suggested Test Organization

Example tests should live in a dedicated test area, such as:

```text
tests/
  examples/
  docs/
```

Suggested examples test files include:

```text
tests/examples/
  bootstrap_empty_project_test.ts
  multi_app_workspace_test.ts
  tools_workspace_test.ts
  managed_vs_plain_test.ts
  logging_run_tree_test.ts
  refresh_reimport_test.ts
  compact_transfer_ready_test.ts
```

And separately:

```text
tests/docs/
  readme_quickstart_test.ts
```

Exact filenames may evolve, but the separation of example scenario tests from unrelated tests should remain clear.

---

## 12. Example Support Tiers

Examples may be organized into support tiers.

A suggested structure is:

```text
examples/
  core/
  advanced/
```

## 12.1. Core examples

Core examples demonstrate the most important user-facing Alteran capabilities.

They must:

- be tested in CI as a normal expectation;
- remain highly reliable;
- stay aligned with README and primary user docs where applicable.

## 12.2. Advanced examples

Advanced examples demonstrate more specialized or richer supported scenarios.

They are still maintained and still expected to work.

They should also be tested, but projects may choose a slightly different CI strategy for them, such as:

- separate CI job;
- reduced platform matrix;
- slower schedule than the fastest core path.

However, advanced examples must not be left entirely unvalidated if they are presented as maintained and supported.

---

## 13. CI Expectations

The repository CI strategy must include automated validation for examples.

At minimum:

- smoke validation for all maintained examples must run in CI;
- README quick start validation must run in CI;
- scenario tests for core examples must run in CI.
- for self-testable examples, repository-level validation should also invoke the
  example's local internal test entry path

Projects may choose to split execution across jobs for performance reasons, but example coverage must remain part of the official quality gate.

A pull request must not be allowed to silently break maintained examples without detection.

---

## 14. Test Design Principles

Example tests should follow these principles.

### 14.1 Hermetic temp-copy execution

Example tests should normally prepare and execute examples in temporary directories.

The preferred lifecycle is:

1. normalize the committed source example tree by deleting known generated artifacts only;
2. create a compact bootstrap-ready temp copy;
3. run `setup` in that temp copy;
4. run the documented validation flow in that temp copy.

For self-testable mini-project examples, that validation flow may include
running the example's own internal tests from inside the prepared temp-copy
context.

For examples whose root is itself an Alteran project, step 2 should preferably use `alteran compact-copy` rather than a raw filesystem copy.

This keeps tests aligned with the product story that examples are transfer-ready and re-hydratable from their committed bootstrap surfaces.

The repository-maintainer name for step 1 should be `reset`, not `reinit`.

### 14.2 Normalization must be non-destructive

The normalization step for committed examples must delete only known generated or recoverable artifacts.

It must not attempt to recreate or overwrite authored business logic.

### 14.3 Example ownership is path-based

Repository-level example validation should think in terms of example paths relative to `examples/`, not in terms of whichever test filename happened to cover that example first.

### 14.1. Validate user-facing flows

Prefer validating the documented scenario over validating invisible implementation details.

### 14.2. Prefer resilient assertions

Assert meaningful success markers, structure, and contracts rather than fragile byte-for-byte full output when exact output is not itself the contract.

### 14.3. Keep example tests understandable

Tests for examples should remain readable enough that contributors can understand what scenario is being protected.

### 14.4. Avoid overfitting to incidental structure

Do not lock tests to irrelevant internal details unless those details are part of the documented contract.

### 14.5. Prefer scenario names over technical names

Where practical, test names should make the protected user scenario obvious.

---

## 15. Relationship Between Examples and Documentation

Examples and docs must reinforce each other.

The intended relationship is:

- documentation explains how and why;
- examples demonstrate runnable scenarios;
- tests ensure both remain honest.

If a user guide or README section points to an example, that example must remain aligned with the described flow.

If an example is used as the practical embodiment of a documented workflow, its test should protect that workflow from silent drift.

---

## 16. Failure Handling Policy

If an example test fails, the repository must not treat that as a cosmetic issue.

A failing example means at least one of the following is true:

- the example is broken;
- the documentation is outdated;
- the supported user flow changed without repository alignment;
- the example no longer deserves maintained status.

When an example fails, the appropriate response is to:

1. fix the example;
2. update the docs if the flow intentionally changed;
3. downgrade or remove the example if it is no longer a supported maintained scenario.

Broken examples must not be left pretending to be current.

---

## 17. Acceptance Criteria

The examples testing policy is considered implemented when all of the following are true:

1. every maintained example has at least one automated smoke test;
2. key examples have scenario-level validation;
3. README quick start has explicit automated validation;
4. example tests are integrated into the repository test suite;
5. examples presented as maintained cannot silently drift without test failure;
6. the test structure remains understandable and does not duplicate the entire product test matrix unnecessarily.

---

## 18. Non-Goals

This document does not require:

- exhaustive unit coverage for all code inside examples;
- exact implementation of CI workflow files;
- identical test depth for every example regardless of value and complexity;
- turning examples into fully independent production-grade applications.

---

## 19. Summary

Alteran examples must be treated as executable documentation.

They must not merely look convincing; they must keep working.

Every maintained example must be automatically validated. Core examples require stronger scenario coverage. README quick start must be tested explicitly.

The goal is to preserve trust: if Alteran shows a user that something works, the repository must continuously verify that this is still true.
