# ADR 0007: Keep `alteran.ts` Thin and Deno-Only

## Status

Accepted

## Context

Alteran is Deno-oriented and the public CLI/runtime contract is intentionally Deno-only.

The repository-level `alteran.ts` should remain a stable and easy-to-understand public entrypoint rather than becoming the home of multi-runtime bootstrap behavior.

## Decision

Alteran keeps a thin public entrypoint:

- root `alteran.ts` stays small
- runtime detection lives in helper modules such as `src/alteran/entry_runtime.ts`

Behaviorally:

1. Under Deno, the entrypoint loads and runs the normal Alteran CLI.
2. Under non-Deno runtimes, the entrypoint fails explicitly and tells the caller to run Alteran with Deno.

## Consequences

Positive:

- public entry remains readable and stable
- Deno-first design stays intact
- runtime detection logic is isolated and testable

Tradeoffs:

- users who try to invoke `alteran.ts` through another runtime get an explicit error instead of a compatibility fallback

## Rejected Alternatives

### Keep a Node bootstrap bridge

Rejected because it expands the CLI surface into a second host-runtime story and adds maintenance burden without meaningfully simplifying the supported bootstrap contract.

### Put all runtime detection directly into root `alteran.ts`

Rejected because it makes the public entrypoint too heavy for a file whose main job is to stay stable and obvious.
