# ADR 0006: Keep Activation Lightweight Rather Than Rebuilding on Every Entry

## Status

Superseded by ADR 0022

## Context

Users enter Alteran projects frequently through `activate` / `activate.bat`.

If activation always performs full initialization work, several problems appear:

- activation becomes noisy
- activation becomes slower as project logic grows
- shell entry does more mutation than users expect
- already initialized projects keep printing initialization messages

At the same time, activation still needs to be robust when the target project is missing minimum bootstrap material such as:

- `.runtime/alteran/mod.ts`
- generated activation artifacts
- bootstrap files and managed gitignore blocks

This creates two different responsibilities:

- first-time or structural initialization
- lightweight environment assurance for repeated entry

## Decision

The core intent remains:

- activation should stay lightweight
- repeated shell entry should not perform full setup/refresh work
- heavier materialization and repair should remain explicit and predictable

This ADR originally introduced a public `ensure-env` command as the mechanism for that separation. That specific command model has since been superseded by ADR 0022.

Current interpretation after ADR 0022:

- public bootstrap/setup concerns belong to `setup` / `setup.bat`
- generated local `activate` / `activate.bat` should stay narrow and activation-focused
- any minimum-repair behavior that used to be associated with `ensure-env` collapses into `setup`, not into a separate public command

## Consequences

Positive:

- repeated activation is quieter and cheaper
- activation semantics remain easier to reason about
- users keep an explicit `refresh` path for heavier synchronization
- the original design pressure behind `ensure-env` is preserved even though the command itself no longer exists

Tradeoffs:

- this ADR should now be read as historical rationale, not as the current command contract
- readers must follow ADR 0022 and the main spec for the current `setup` / generated `activate` model

## Rejected Alternatives

### Always run full setup from `activate`

Rejected because it makes ordinary shell entry too heavy and too noisy.

### Always run `refresh` from `activate`

Rejected because activation should not silently perform broad synchronization work on every shell entry.
