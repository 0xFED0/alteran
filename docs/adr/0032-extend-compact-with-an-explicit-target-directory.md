# ADR 0032: Extend `compact` with an Explicit Target Directory

## Status

Accepted

## Context

Alteran already treats `setup [dir]` as a legitimate external-targeting operation.

In practice, maintainers and advanced users also need an explicit way to reduce some other Alteran project directory to a transfer-ready state without first `cd`-ing into it and activating it manually.

This need appears in several realistic workflows:

- compacting another managed project before handoff;
- compacting an app-oriented project folder;
- normalizing a source example tree when that is explicitly requested;
- scripting portability preparation across several project directories.

The current active-project-only form of `compact` adds unnecessary friction to those workflows.

## Decision

Alteran should extend `compact` so it supports both:

```sh
alteran compact
alteran compact [dir]
```

The no-argument form keeps its current meaning:

- compact the current active Alteran project.

The optional `[dir]` form becomes an explicit external-targeting Alteran project operation:

- resolve the target directory as an Alteran-owned project root;
- apply the same compact semantics to that target directory;
- do not require a prior `cd` into the target.

This is an explicit exception to the otherwise active-project-oriented command family, justified because portability preparation is a close sibling of `setup [dir]`.

`compact [dir]` remains an Alteran-owned project operation. It is not intended as a generic arbitrary-path mutator.

## Consequences

### Positive

- portability workflows become scriptable without manual directory switching;
- repository-maintainer example normalization can use a product-level command rather than bespoke shell logic;
- users gain a clearer symmetry between `setup [dir]` and `compact [dir]`.

### Tradeoffs

- the command model becomes slightly broader than a purely active-project-only cleanup surface;
- help text and docs must clearly explain the distinction between `compact`, `compact [dir]`, and `compact-copy`.

## Follow-up

If implemented, follow-up changes should update:

- the unified product spec;
- cleanup and command reference docs;
- tests for explicit external-targeting compact behavior.
