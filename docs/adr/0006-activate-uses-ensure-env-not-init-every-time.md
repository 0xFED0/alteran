# ADR 0006: `activate` Uses `ensure-env`, Not Full `init`, On Every Entry

## Status

Accepted

## Context

Users enter Alteran projects frequently through `activate` / `activate.bat`.

If activation always performs full initialization work, several problems appear:

- activation becomes noisy
- activation becomes slower as project logic grows
- shell entry does more mutation than users expect
- already initialized projects keep printing initialization messages

At the same time, activation still needs to be robust when the target project is
missing minimum bootstrap material such as:

- `.runtime/alteran/mod.ts`
- generated env scripts
- bootstrap files and managed gitignore blocks

This creates two different responsibilities:

- first-time or structural initialization
- lightweight environment assurance for repeated entry

## Decision

Alteran separates these responsibilities:

- `init` performs full project initialization
- `refresh` performs explicit synchronization/rebuild work
- `ensure-env` is the lightweight command used by `activate`

`activate` should:

1. locate or bootstrap a usable Deno executable
2. locate or bootstrap a usable Alteran entrypoint
3. run `alteran ensure-env <target>`
4. apply `alteran shellenv <target>`

`ensure-env` should:

- initialize a project when it is clearly uninitialized
- otherwise restore only the minimum managed files and runtime material needed
  for activation
- avoid behaving like an unconditional full refresh

## Consequences

Positive:

- repeated activation is quieter and cheaper
- activation semantics are easier to reason about
- users keep an explicit `refresh` path for heavier synchronization
- bootstrap remains self-healing for missing minimum managed files

Tradeoffs:

- Alteran now maintains a dedicated middle layer between `init` and `refresh`
- maintainers must keep `ensure-env` conservative so it does not drift into an
  implicit full refresh

## Rejected Alternatives

### Always run `init` from `activate`

Rejected because it makes ordinary shell entry too heavy and too noisy.

### Always run `refresh` from `activate`

Rejected because activation should not silently perform broad synchronization
work on every shell entry.
