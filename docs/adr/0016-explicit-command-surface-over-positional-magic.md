# ADR 0016: Prefer an Explicit Command Surface over Positional Magic

## Status

Accepted

## Context

CLI tools become harder to teach and maintain when they collapse multiple intentions into positional shortcuts and ambiguous implicit behavior. Alteran manages apps, tools, runtime state, and Deno passthrough; hidden inference would make that surface harder to understand.

## Decision

Alteran prefers explicit command families and verbs such as:

- `alteran app run <name>`
- `alteran tool run <name>`
- `alteran test`

Core operations are not collapsed into positional magic where `run` is implied or bare arguments silently change meaning.

## Consequences

Positive:

- the command model is easier to teach and extend
- help output can mirror conceptual structure directly

Tradeoffs:

- commands are sometimes a little longer to type

## Rejected Alternatives

### Infer more behavior from positional arguments

Rejected because it reduces clarity and makes future command evolution messier.
