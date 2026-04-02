# ADR 0013: Separate External-Project Commands from Active-Project Commands

## Status

Accepted

## Context

Some Alteran commands must operate on arbitrary target directories during
bootstrap or initialization. Others should operate strictly on the active
project to avoid ambiguous or accidental cross-project mutations.

## Decision

Alteran divides command scope into two categories.

External-project commands may target an explicit project directory, for example:

- `init [dir]`
- `ensure-env [dir]`
- `shellenv [dir]`

Active-project commands operate on the project resolved through `ALTERAN_HOME`
or the active working context, for example:

- `refresh`
- `app ...`
- `tool ...`
- `reimport ...`
- `clean ...`
- `compact`

## Consequences

Positive:

- command intent is clearer and safer
- bootstrap flows can target arbitrary directories without redefining ordinary
  maintenance semantics

Tradeoffs:

- users must learn which commands are external-targeting versus active-project
  commands

## Rejected Alternatives

### Let all commands accept arbitrary project paths

Rejected because it would make maintenance commands easier to misuse.
