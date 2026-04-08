# ADR 0033: Add `compact-copy` as a Non-Destructive Portability Command

## Status

Accepted

## Context

`compact` is intentionally destructive to local generated state in the target project directory.

That is correct when the user wants to make one project transfer-ready in place, but it is the wrong primitive for workflows that need:

- a compact handoff copy in another location;
- a hermetic temp copy for validation;
- portable staging without dirtying the source tree.

The Alteran repository examples are a concrete case of this need, but the need is not unique to repository examples.

## Decision

Alteran should add a new portability command:

```sh
alteran compact-copy <destination> [--source=<project-dir>]
```

If `--source` is omitted, the source project is the current active Alteran project.

`compact-copy` should:

- resolve the source Alteran project explicitly;
- create a destination directory in bootstrap-ready compact form;
- copy only transfer-safe project material;
- omit runtime, activation, build, and other generated artifacts that in-place `compact` would remove;
- avoid mutating the source project directory in place.

Conceptually:

- `compact` means "make this project transfer-ready in place";
- `compact-copy` means "create a transfer-ready copy elsewhere".

This command should be the preferred shared portability primitive for hermetic example testing and for other non-destructive portability workflows.

## Consequences

### Positive

- temp-copy-based testing can use a real product command instead of hidden harness logic;
- handoff and staging flows stop requiring destructive in-place compacting;
- the portability story becomes clearer and more teachable.

### Tradeoffs

- Alteran gains another top-level portability command that needs help text, docs, and tests;
- implementation must carefully define which files belong in a compact copy.

## Follow-up

If implemented, follow-up changes should update:

- the unified product spec;
- cleanup and command reference docs;
- repository example workflow docs and tests;
- any future `examples` tool that depends on temp-copy-based validation.
