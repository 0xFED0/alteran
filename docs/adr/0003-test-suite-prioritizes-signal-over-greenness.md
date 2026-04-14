# ADR 0003: Test Suite Prioritizes Signal Over Greenness

## Status

Accepted

## Context

Alteran’s most important risks are user-facing bootstrap and activation
failures.

Those failures often appear in scenarios that are:

- ordinary for users
- slightly unusual in implementation detail
- easy to miss if tests are softened to match current behavior

During test development, there is recurring pressure to:

- weaken expectations so the suite is green
- skip scenarios that currently fail in the product
- reinterpret product bugs as “test issues” when the scenario is realistic

At the same time, realistic end-to-end failures can be difficult to triage when
test logs contain only process start/finish markers and detached stdout/stderr
blobs. The suite needs enough structured diagnostic context to help maintainers
distinguish:

- product failure
- harness failure
- host-environment precondition failure

That would reduce the value of the suite as an early warning system.

## Decision

The Alteran test suite should prefer product signal over nominal greenness.

Specifically:

1. If a test reproduces a realistic user-facing failure that should work by
   specification, the test should remain strict.
2. A currently failing test is acceptable when it documents a genuine product
   gap or regression.
3. Tests should be weakened only when the problem is truly in the harness or in
   the test’s assumptions.
4. Unsupported or exploratory scenarios must be labeled honestly, but should not
   be silently converted into passing tests.
5. Repository-level and other external test harnesses may emit structured
   step-level diagnostic events when that materially improves post-failure
   triage.
6. Such diagnostic logging should prefer concise, high-value breadcrumbs over
   raw log duplication.
7. Example-internal tests should stay lightweight and should not gain extra
   logging dependencies only for repository-level observability.

## Consequences

Positive:

- regressions stay visible
- the suite captures realistic user pain rather than implementation comfort
- test failures become more actionable as product feedback
- post-failure traces in `events.jsonl` become more useful for classifying
  failures without rerunning everything interactively

Tradeoffs:

- the suite may intentionally contain red tests while product bugs remain open
- maintainers must distinguish harness failures from product failures
- external test helpers gain a small amount of observability-oriented structure

## Rejected Alternatives

### Require all committed tests to be green at all times

Rejected because it incentivizes weakening or removing useful regression tests.

### Encode only currently working behavior

Rejected because it makes the suite descriptive of the implementation instead of
normative for the product.

### Keep external test event streams minimal and rely only on stdout/stderr

Rejected because complex bootstrap and activation failures often require context
about the chosen fixture, command, environment override, and test stage. That
context is best captured as structured breadcrumbs in the outer harness, not
reconstructed later from sparse process metadata.
