# ADR 0003: Test Suite Prioritizes Signal Over Greenness

## Status

Accepted

## Context

Alteran’s most important risks are user-facing bootstrap and activation failures.

Those failures often appear in scenarios that are:

- ordinary for users
- slightly unusual in implementation detail
- easy to miss if tests are softened to match current behavior

During test development, there is recurring pressure to:

- weaken expectations so the suite is green
- skip scenarios that currently fail in the product
- reinterpret product bugs as “test issues” when the scenario is realistic

That would reduce the value of the suite as an early warning system.

## Decision

The Alteran test suite should prefer product signal over nominal greenness.

Specifically:

1. If a test reproduces a realistic user-facing failure that should work by specification, the test should remain strict.
2. A currently failing test is acceptable when it documents a genuine product gap or regression.
3. Tests should be weakened only when the problem is truly in the harness or in the test’s assumptions.
4. Unsupported or exploratory scenarios must be labeled honestly, but should not be silently converted into passing tests.

## Consequences

Positive:

- regressions stay visible
- the suite captures realistic user pain rather than implementation comfort
- test failures become more actionable as product feedback

Tradeoffs:

- the suite may intentionally contain red tests while product bugs remain open
- maintainers must distinguish harness failures from product failures

## Rejected Alternatives

### Require all committed tests to be green at all times

Rejected because it incentivizes weakening or removing useful regression tests.

### Encode only currently working behavior

Rejected because it makes the suite descriptive of the implementation instead of normative for the product.
