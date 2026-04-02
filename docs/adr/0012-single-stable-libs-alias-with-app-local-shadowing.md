# ADR 0012: Use a Single `@libs/...` Alias with App-Local Shadowing

## Status

Accepted

## Context

Alteran supports both project-wide shared libraries and app-local libraries.
Using separate alias families would expose storage placement in imports and
create churn when code moves between local and shared scope.

## Decision

Alteran uses a single library alias family:

- `@libs/...`

In app context, resolution order is:

1. `apps/<app>/libs/...`
2. project-root `libs/...`

If both locations provide the same logical library name, the app-local library
shadows the project-root library. Core Alteran behavior does not treat this as
an automatic error.

## Consequences

Positive:

- imports remain stable when libraries move between app-local and project-wide
  placement
- exported apps can remain self-contained without import rewriting

Tradeoffs:

- teams that want stricter uniqueness may need dedicated linting/tooling

## Rejected Alternatives

### Separate `@app-libs/...` and `@libs/...`

Rejected because it bakes current placement into imports and creates avoidable
churn.
