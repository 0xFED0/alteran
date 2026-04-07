# ADR 0007: Keep `alteran.ts` Thin and Use Node Only as a Bootstrap Bridge

## Status

Accepted

## Context

Alteran is Deno-oriented, but repository and package consumers may still invoke
the public top-level entrypoint from environments where Node.js is present.

There is value in allowing:

- `node alteran.ts ...`
- package-manager-driven Node entry invocation

However, there is no intention to make the Alteran runtime itself Node-native.

At the same time, the repository-level `alteran.ts` should remain a stable and
easy-to-understand public entrypoint rather than becoming the home of complex
runtime detection and bootstrap behavior.

## Decision

Alteran keeps a thin public entrypoint:

- root `alteran.ts` stays small
- runtime detection lives in helper modules such as
  `src/alteran/entry_runtime.ts`
- Node-specific bootstrap behavior lives in
  `src/alteran/node_compat.ts`

Behaviorally:

1. Under Deno, the entrypoint loads and runs the normal Alteran CLI.
2. Under Node.js, the entrypoint uses a compatibility bridge whose purpose is
   only to obtain Deno and re-execute Alteran under Deno.
3. This bridge may reuse an existing repository-managed Deno when available
   before downloading its own temporary one.
4. Unsupported runtimes should fail explicitly.

This is a bootstrap convenience, not a claim of Node-native Alteran support.

## Consequences

Positive:

- public entry remains readable and stable
- Deno-first design stays intact
- Node invocation can still help with package/bootstrap ergonomics
- runtime detection logic is isolated and testable

Tradeoffs:

- a small amount of Node-specific maintenance remains necessary
- users may need documentation to understand that Node support is limited to
  bootstrapping into Deno, not replacing it

## Rejected Alternatives

### Make Alteran fully Node-compatible

Rejected because it changes the product’s runtime identity and would require far
more compatibility work than justified.

### Put all runtime detection directly into root `alteran.ts`

Rejected because it makes the public entrypoint too heavy for a file whose main
job is to stay stable and obvious.
