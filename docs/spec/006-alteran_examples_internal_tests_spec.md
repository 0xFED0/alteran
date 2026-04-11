# Alteran Examples Internal Tests Specification

## 1. Purpose

This document defines the policy for optional internal tests inside Alteran example projects.

Its purpose is to clarify:

- when an example should contain its own self-contained tests;
- when an example should not contain internal tests;
- how internal example tests relate to repository-level example tests;
- whether repository-level example tests should invoke internal example tests;
- which test layer remains the primary source of truth for supported example behavior.

This document extends the examples testing policy rather than replacing it.

It does not remove the requirement for repository-level example validation.

---

## 2. Background

Alteran examples are executable documentation.

They are intended to demonstrate real supported usage scenarios rather than decorative repository content.

The repository already includes repository-level example validation and documentation validation. Those tests verify example correctness from outside the example directories, using repository-controlled orchestration, temporary copies, setup flows, activation flows, and documentation-aligned commands.

At the same time, some examples are rich enough to behave like small self-contained Alteran projects. In those cases, it may be useful for the example to include its own internal tests so that the example remains testable even when copied out of the repository and used independently.

This document defines how to use that idea without creating duplication or confusion.

---

## 3. Core Decision

Internal tests inside examples are allowed and encouraged **when they meaningfully improve the example as a self-contained project**.

They are not required for every example.

Repository-level tests remain mandatory and remain the primary repository-level source of truth.

If an example contains internal tests, the repository-level test for that example should invoke those internal tests from within the example's own managed environment or local project context.

This ensures that:

- the example's internal tests stay runnable and current;
- the example remains self-checking when copied independently;
- repository-level validation still verifies the public scenario from outside the example;
- responsibility does not collapse into a single ambiguous test layer.

---

## 4. Policy Summary

The intended policy is:

1. every maintained example must have repository-level validation;
2. some examples may additionally contain internal tests;
3. internal tests should exist only when they add real value to the example as a standalone project;
4. if internal tests exist, the corresponding repository-level example test should run them as one step of scenario validation;
5. repository-level tests must not fully delegate truth to internal example tests;
6. bootstrap-oriented examples are not required to gain internal tests if doing so would weaken their clarity or distort their purpose.

---

## 5. When Internal Example Tests Make Sense

Internal tests make sense when an example behaves like a real small project rather than only a bootstrap shell.

They are especially appropriate when an example:

- contains actual project logic worth validating from within;
- can reasonably be copied out of the repository and used independently;
- is intended to serve as a miniature reference project;
- has meaningful local invariants that belong to the example itself;
- benefits from being runnable and testable through its own local commands.

In these situations, internal tests strengthen the example's value as a self-contained artifact.

---

## 6. When Internal Example Tests Do Not Make Sense

Internal tests are not required when an example exists mainly to demonstrate repository-level bootstrap or structural transformation.

They are usually not worth adding when an example:

- is intentionally minimal or near-empty;
- exists mainly to demonstrate setup/bootstrap behavior;
- would become conceptually cluttered by added internal test structure;
- would gain little practical value from local self-tests.

For such examples, repository-level scenario testing is sufficient and preferable.

A bootstrap-first example should not be forced to pretend it is a richer application than it really is.

---

## 7. Example Categories and Expected Behavior

## 7.1. Bootstrap-oriented examples

Examples whose primary purpose is bootstrap, initialization, or basic project materialization may rely entirely on repository-level scenario tests.

Internal tests are optional and usually unnecessary for these.

Typical characteristics:

- near-empty committed state;
- value comes from setup or activation transforming the directory;
- the example is primarily about project creation rather than local app/tool logic.

## 7.2. Mini-project examples

Examples whose primary purpose is to demonstrate meaningful app, tool, workspace, logging, or other project-level behavior should be considered candidates for internal tests.

Typical characteristics:

- actual app or tool logic exists;
- the example has a committed project shape worth preserving locally;
- the example benefits from being independently testable after copy or extraction.

## 7.3. Advanced supported examples

Advanced examples may also benefit from internal tests if they are intended to remain maintained, transferable, and self-verifiable.

Advanced examples are not exempt from repository-level validation.

---

## 8. Responsibility Split Between Test Layers

Internal tests and repository-level tests serve different purposes and must not be confused.

## 8.1. Internal example tests are responsible for

Internal example tests validate the example **as a project from within itself**.

They are responsible for things such as:

- local project behavior;
- internal invariants of the example scenario;
- app or tool behavior that belongs to the example itself;
- local expectations that should remain true if the example is copied elsewhere.

They should answer the question:

**Does this example still work as its own project?**

## 8.2. Repository-level example tests are responsible for

Repository-level tests validate the example **as part of the Alteran repository and its documentation surface**.

They are responsible for things such as:

- copying the example to temporary space;
- repository-controlled setup and activation orchestration;
- documented user-facing commands;
- alignment with example README and repository docs;
- generated file expectations;
- repository-specific environment wiring;
- public scenario correctness.

They should answer the question:

**Does this example still truthfully represent a supported Alteran scenario from the repository's point of view?**

## 8.3. Neither layer replaces the other

Internal tests do not replace repository-level tests.

Repository-level tests do not automatically eliminate the value of internal tests.

The two layers complement each other when used deliberately.

---

## 9. Required Invocation Rule

If an example includes internal tests, the repository-level test for that example should invoke those internal tests from **inside the example's own runtime and command context**.

This means the repository-level test should run the example's internal test command only after the example has been prepared in the intended example-local way.

Typical acceptable forms include:

- `alteran test` from inside the example;
- `deno test` from inside the example;
- another example-local documented test entrypoint if intentionally designed.

The important rule is that the repository-level test must execute the internal tests **as the example itself would expect them to be executed**, not by bypassing the example's own local execution model.

This ensures that internal tests themselves remain real, current, and usable.

---

## 10. Why Repository-Level Tests Should Invoke Internal Tests

When repository-level tests invoke internal tests for applicable examples, they gain an additional useful signal:

- the internal tests have not gone stale;
- the example is still self-testable when used independently;
- the example's local commands and test expectations still work;
- repository maintainers are less likely to forget that an example claims to be self-contained.

This does **not** mean repository-level tests should stop making their own assertions.

The invocation of internal tests is a verification step, not a total handoff of responsibility.

---

## 11. Repository-Level Tests Must Not Fully Delegate

Even when a repository-level example test invokes the example's own internal test command, the repository-level test must still keep repository-level assertions of its own.

For example, repository-level tests may still need to assert:

- setup succeeded;
- activation succeeded;
- documented commands are runnable;
- expected files were created;
- expected README-promised behaviors remain true;
- repository-controlled scenario invariants remain intact.

The repository-level test must not collapse into a single statement equivalent to:

> run the example's own tests and assume everything is fine.

That would weaken repository coverage and blur the purpose of the outer test layer.

---

## 12. Suggested Internal Test Style

When internal tests are added to an example, they should remain appropriate for that example's size and role.

Internal example tests should generally be:

- small;
- local;
- easy to understand;
- focused on the example's own behavior;
- runnable through the example's own local commands.

They should not attempt to recreate repository-level harness responsibilities.

They should not rely on hidden repository-global knowledge unless that dependency is itself a deliberate and documented feature of the example.

---

## 13. Suggested Command Model

Each self-testable example should expose a simple local test entry path.

Typical acceptable models include:

- `alteran test`
- `deno test`
- an example-local documented task that resolves to one of the above

The chosen command should be obvious, documented in the example README when needed, and aligned with the example's own project model.

Repository-level orchestration should call that local entry path rather than reimplement the example's entire internal test behavior externally.

---

## 14. Example Selection Guidance

The following examples are strong candidates for internal tests when their local project logic is meaningful:

- multi-app workspace examples;
- tools workspace examples;
- managed execution examples;
- logging behavior examples;
- refresh or reimport examples;
- compact or transfer-ready examples;
- advanced examples that are intentionally maintained as real mini-projects.

Bootstrap-empty-folder style examples are not strong candidates by default.

---

## 15. Relationship to Example Support Status

If an example contains internal tests, that is a signal that the example is intended to function as a self-verifiable project.

That signal creates a maintenance expectation.

Therefore:

- internal tests must remain runnable;
- repository-level tests must continue to invoke them where applicable;
- stale internal tests must not be left behind as dead decorative files.

If maintainers no longer want an example to carry that self-contained expectation, the internal tests should be removed or the example's support level should be reconsidered.

---

## 16. Failure Handling

If an internal example test fails during repository-level validation, that failure must be treated as meaningful.

It indicates that at least one of the following is true:

- the example's local project behavior has drifted;
- the internal tests became stale;
- the example's documented local testing path no longer works;
- the example should no longer claim to be self-testable.

The appropriate response is to:

1. fix the example;
2. fix or update the internal tests;
3. update the example documentation if the local test path intentionally changed;
4. remove the internal tests if they no longer provide real value.

---

## 17. Non-Goals

This document does not require:

- internal tests for every example;
- identical test structure across all examples;
- duplication of repository-level scenario logic inside each example;
- replacing repository-level harnesses with example-local harnesses;
- turning minimal bootstrap examples into artificial mini-applications.

---

## 18. Acceptance Criteria

This policy is considered implemented when all of the following are true:

1. repository-level example validation remains mandatory for all maintained examples;
2. examples that meaningfully benefit from self-contained local tests include them;
3. examples that include internal tests expose a clear local test entry command;
4. repository-level tests invoke those internal tests from the example's own local execution context;
5. repository-level tests still keep their own outer assertions and do not fully delegate validation;
6. bootstrap-oriented examples are not forced into unnecessary internal test structure.

---

## 19. Summary

Internal example tests are valuable when an Alteran example is rich enough to act like a small self-contained project.

They are optional, selective, and purpose-driven.

Repository-level tests remain the outer truth layer.

When internal tests exist, repository-level example tests should run them from inside the example's own environment. That keeps the example self-testable, keeps the internal tests honest, and preserves the difference between validating the example as a project and validating the example as repository-supported executable documentation.