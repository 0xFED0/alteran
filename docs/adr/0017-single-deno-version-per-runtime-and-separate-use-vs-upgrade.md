# ADR 0017: Manage a Single Deno Version per Runtime and Separate `use` from `upgrade`

## Status

Accepted

## Context

Alteran needs Deno version management, but not at the cost of turning `.runtime/` into a multi-version toolchain manager. It also needs to distinguish between changing desired project configuration and upgrading installed tooling.

## Decision

Alteran manages exactly one effective Deno version per runtime.

It also separates two kinds of actions:

- `alteran use --deno=...` changes desired project configuration
- `alteran upgrade --deno[=...]` upgrades the installed Alteran-managed Deno runtime without silently rewriting configuration policy

`alteran update` remains dependency-update semantics, not runtime policy or Alteran self-upgrade policy.

## Consequences

Positive:

- runtime version management stays simple and predictable
- configuration mutation is explicit
- installed upgrade and desired version policy remain distinct

Tradeoffs:

- Alteran does not provide nvm-like multi-version behavior inside one runtime

## Rejected Alternatives

### Support multiple Deno versions inside one `.runtime/`

Rejected because it adds complexity beyond current goals.
