# ADR 0009: Separate Alteran Runtime from Runtime Helper Tools

## Status

Accepted

## Context

Alteran has its own runtime code, but it may also materialize helper tools used for bootstrap, maintenance, or future extensions. If everything is treated as "just a tool", the runtime itself loses a clear architectural identity.

## Decision

Alteran’s own runtime lives under:

- `.runtime/alteran/`

Runtime helper tools live under:

- `.runtime/tools/`

Shared runtime libraries live under:

- `.runtime/libs/`

The regular helper `tool.ts` + `tool/` pattern applies to runtime helper tools, not to Alteran’s canonical runtime layout.

## Consequences

Positive:

- Alteran has a clear runtime center
- helper tools can evolve without redefining the runtime’s identity

Tradeoffs:

- the runtime layout contains more top-level concepts to explain

## Rejected Alternatives

### Put everything under `.runtime/tools/`

Rejected because it weakens the distinction between the platform runtime and optional helpers.
