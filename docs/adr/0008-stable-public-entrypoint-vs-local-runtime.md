# ADR 0008: Stable Public Entrypoint vs Local Materialized Runtime

## Status

Accepted

## Context

Alteran needs a stable public entrypoint for repository development, publication, and bootstrap flows, while ordinary managed projects must remain self-contained and run from their locally materialized runtime.

Without an explicit split, repository entry assumptions can leak into normal projects and blur the boundary between public bootstrap surface and local runtime ownership.

## Decision

Alteran uses a split entry model:

- `alteran.ts` is the stable public entrypoint for repository and publication use
- `src/alteran/mod.ts` is the authored source entrypoint behind that public proxy
- `.runtime/alteran/mod.ts` is the canonical materialized runtime entrypoint in managed projects

The public entry stays intentionally thin. Managed projects execute against the locally materialized runtime.

## Consequences

Positive:

- public usage stays stable
- managed projects remain self-contained
- repository and publication flows stay aligned without turning the public entrypoint into the runtime home

Tradeoffs:

- there are multiple relevant entrypoints to explain
- documentation and tooling must stay clear about when each one applies

## Rejected Alternatives

### Make `alteran.ts` the canonical runtime implementation

Rejected because it blurs public bootstrap surface and project-local runtime.
