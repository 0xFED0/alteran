# ADR 0015: Managed Execution Uses Preinit While Plain Deno Stays Plain

## Status

Accepted

## Context

Alteran wants process-level initialization for managed execution, including
runtime context setup and logging bootstrap, but it should not silently redefine
what plain `deno run` or `deno task` means.

## Decision

Alteran introduces a dedicated preload entrypoint:

- `.runtime/alteran/preinit.ts`

Managed execution paths use this preload mechanism. Conceptually:

- `alteran run ...` and `alteran task ...` run with Alteran preinit
- plain `deno run` and plain `deno task` remain plain Deno
- `alteran deno ...` provides Deno execution inside the Alteran environment
  without pretending that bare Deno changed semantics

## Consequences

Positive:

- managed execution gets a proper initialization hook
- users retain a clean mental model of plain Deno

Tradeoffs:

- there is an additional execution mode distinction to document

## Rejected Alternatives

### Mutate plain Deno semantics implicitly in the activated shell

Rejected because it would make debugging and user expectations murkier.
