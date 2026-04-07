# ADR 0023: Project-Scoped Execution Context with a Canonical Root Log Directory

## Status

Accepted

## Context

Alteran-managed commands propagate runtime and logging context through environment variables such as:

- `ALTERAN_HOME`
- `ALTERAN_RUN_ID`
- `ALTERAN_ROOT_RUN_ID`
- `ALTERAN_ROOT_LOG_DIR`

This is useful for parent/child execution inside one project, but it becomes dangerous when a user switches into another Alteran project. In that case, a foreign inherited context can make the second project:

- resolve itself against the wrong `.runtime`
- attach its child runs to the wrong invocation tree
- write logs into another project's root log directory

The normal user workflow for entering another project is explicit context switching through project bootstrap/activation surfaces such as:

- `setup`
- `activate`
- `shellenv`
- generated `app` / `app.bat`

Alteran also allows rare advanced scenarios where a caller may intentionally invoke specific files in another project without switching into that project's full context, but that is not the default user model.

When such an advanced cross-project mode exists, it should be explicit and visually obvious, for example through a dedicated `external` command that requires a target config anchor such as `alteran.json` or `app.json`.

## Decision

Alteran execution context is project-scoped, not shell-scoped.

Cross-project inherited Alteran runtime/logging context must not remain authoritative by default.

### Context-switching entrypoints

The following entrypoints define a hard project boundary:

- `setup`
- `activate`
- `shellenv`
- generated `app` / `app.bat`

When they target a project, they must treat that project as the authoritative execution context and replace foreign inherited Alteran runtime/logging state.

### Same-project inheritance

Inheritance is still valid for nested invocations inside the same project, for example:

- `app -> tool`
- `tool -> app`
- `tool -> task`
- `tool -> run`

The distinction is not based on command type. It is based on whether the inherited context belongs to the same project.

### Validation model

Alteran should treat these variables as context-defining:

- `ALTERAN_HOME`
- `ALTERAN_RUN_ID`
- `ALTERAN_ROOT_RUN_ID`
- `ALTERAN_ROOT_LOG_DIR`
- `ALTERAN_LOG_MODE`
- `ALTERAN_LOG_CONTEXT_JSON`

For a project to accept inherited logging context, the inherited `ALTERAN_ROOT_LOG_DIR` must belong to that project's canonical log area under:

```text
<project>/.runtime/logs/
```

If inherited context does not match the current project, Alteran should self-heal by resetting/rebuilding project-local context rather than treating the foreign context as authoritative.

### Canonical log root vs custom copies

Even when a user configures a custom log-copy destination such as `ALTERAN_CUSTOM_LOG_DIR`, Alteran must still preserve a canonical per-project root log directory under:

```text
<project>/.runtime/logs/
```

That canonical location remains the source of truth for:

- `ALTERAN_ROOT_LOG_DIR`
- invocation metadata such as `metadata.json`
- run identity validation

Custom log locations are copy/mirror targets, not replacements for the canonical root log directory.

### Relative path semantics

Relative paths in Alteran-managed configuration are not interpreted relative to the caller's current shell directory.

They are interpreted relative to the project/config location they belong to, for example:

- root-level config paths relative to the project root / root config
- app-local config paths relative to the app directory / app-local config

This prevents accidental `cd`-based path capture from changing project meaning.

## Consequences

Positive:

- switching into another project becomes safe and predictable
- nested same-project managed runs still preserve parent/child traceability
- canonical per-project logs stay reliable even when custom log mirrors exist
- config-relative paths remain stable under changing shell working directories

Tradeoffs:

- advanced cross-project execution still requires an explicit dedicated mode
- inherited Alteran env is treated as advisory rather than always reusable

## Rejected Alternatives

### Treat Alteran context as shell-global until manually cleared

Rejected because it allows one project's runtime/logging identity to leak into another project's execution.

### Replace canonical project logs with a custom external log directory

Rejected because it weakens project-local debugging, identity validation, and portable inspection of invocation metadata.
