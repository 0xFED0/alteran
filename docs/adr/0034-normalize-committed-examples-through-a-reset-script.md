# ADR 0034: Normalize Committed Examples Through a Non-Destructive `reset` Script

## Status

Accepted

## Context

The Alteran repository examples are committed teaching surfaces, not disposable scratch workspaces.

At the same time, normal maintainer work can leave behind generated or recoverable artifacts inside `examples/`, such as:

- `.runtime/`
- generated `activate` / `activate.bat`
- generated standalone `app` / `app.bat`
- nested app-local runtimes
- `dist/`
- other recoverable local state

This is especially dangerous for examples such as `01-bootstrap-empty-folder`, where the intended value of the example depends on preserving a bootstrap-first starting state.

The repository therefore needs a lightweight, explicit, repeatable way to bring committed examples back to their intended authored baseline without overwriting authored code.

This need exists independently of the future higher-level `examples` maintainer tool.

## Decision

The repository should include a small committed example-normalization script under `examples/`.

The canonical maintainer verb for this operation is:

```text
reset
```

Not:

- `reinit`
- `reinitialize`
- any other name that reintroduces the removed `init` concept into Alteran vocabulary

The script may be implemented in `sh` or `ts`, but it must be:

- committed;
- path-selectable;
- idempotent;
- non-destructive to authored source;
- usable both manually and from future repository-maintainer tooling.

Its job is only to delete known generated or recoverable artifacts from committed example trees.

It must not:

- regenerate business logic;
- rewrite authored config unless that file is itself explicitly classified as generated for that example workflow;
- invent missing files;
- silently mutate examples into a new authored state.

## Consequences

### Positive

- maintainers get a safe baseline-restoration step before temp-copy testing or gallery maintenance;
- examples such as `01-bootstrap-empty-folder` can preserve their intended teaching shape;
- future repository tooling can build on one explicit normalization surface instead of ad hoc shell deletion logic.

### Tradeoffs

- the repository gains one more committed maintainer helper to keep current;
- the generated-vs-authored boundary for examples must stay explicit and documented.

## Follow-up

If implemented, follow-up changes should update:

- the examples spec;
- the examples testing spec;
- the future `examples` maintainer tool contract so it can call `reset` explicitly.
