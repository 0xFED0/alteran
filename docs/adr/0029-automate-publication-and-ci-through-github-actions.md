# ADR 0029: Automate Publication and Test Coverage Through GitHub Actions

## Status

Accepted

## Context

Alteran now has explicit staged publication helpers:

- `prepare_jsr`
- `prepare_zip`
- `publish_jsr`

Those flows are product-critical and should not depend only on local manual discipline. The repository also has multiple test layers that are easy to skip accidentally if automation is missing.

## Decision

Alteran uses GitHub Actions automation for two distinct concerns:

- JSR publication on version tags
- release-zip publication on version tags
- continuous test execution on normal repository changes

The tag-driven publication model remains version-authoritative:

- version tags use the form `v<version>`
- publication workflows are gated by the shared repository test workflow
- workflows verify that the tag matches `ALTERAN_VERSION`
- JSR publication runs through `publish_jsr`
- release publication prepares versioned zip assets from the staged JSR payload

The CI workflow should exercise the important repository test surfaces explicitly, including:

- source/test `deno check`
- unit tests
- repository e2e tests
- docs/examples tests
- docker e2e tests on Linux
- Windows e2e tests on Windows

## Consequences

Positive:

- publication flows become repeatable and auditable
- zip releases stay aligned with the staged JSR payload
- regressions are more likely to be caught before tags are cut

Tradeoffs:

- CI becomes broader and slower than a minimal smoke-only workflow
- workflow files need to stay synchronized with the supported test matrix

## Rejected Alternatives

### Only document manual publication

Rejected because publication is too important to rely entirely on local habit.

### Only run a minimal smoke CI

Rejected because Alteran's behavior often breaks at the integration boundary, especially around setup, managed execution, docs/examples, and platform-specific flows.
