# ADR 0011: Repository Layout Mirrors Managed Projects but Remains Distinct

## Status

Accepted

## Context

Alteran is both a product and a project template/runtime manager. Its own source repository should resemble a real Alteran-managed project closely enough that repository development reflects real usage, while still preserving repository only concerns such as authored source, publication outputs, and documentation.

## Decision

The Alteran source repository intentionally resembles a managed project, including first-class `apps/`, `tools/`, `libs/`, `tests/`, and `.runtime/`, while also keeping repository-specific areas such as `src/`, `docs/`, `examples/`, and `dist/`.

The repository is not identical to a normal managed project. It is a related but distinct layout with mirrored concepts where practical.

## Consequences

Positive:

- repository development stays grounded in real usage patterns
- tooling for managed projects can often be validated in the repository itself

Tradeoffs:

- contributors must understand that similar layouts do not imply identical semantics

## Rejected Alternatives

### Use a completely separate repository layout unrelated to managed projects

Rejected because it would make the product harder to dogfood.
