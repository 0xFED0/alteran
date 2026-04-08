# ADR 0035: Add an Explicit `from` Command for Context-Rebased Execution

## Status

Accepted

## Context

Alteran already distinguishes between:

- ordinary active-project commands that operate in the current Alteran context;
- explicit external execution through `alteran external <path-to-json> ...`, which targets a foreign project or app through an explicit config anchor.

There is still a useful missing mode for repository-maintenance and example-management workflows:

- run an ordinary Alteran command *as if the current context had first been switched* to another known target;
- address that target either by a registered app name or by an explicit project directory;
- keep this behavior visually obvious instead of hiding it inside ordinary `app`, `tool`, `task`, or `run` syntax.

This is especially useful for future repository-level tooling such as example management, where commands may need to say "run this Alteran command from that app" or "from that project directory" without teaching every command family its own cross-target syntax.

## Decision

Alteran adds an explicit context-rebased command:

```text
alteran from app <name> <command> [args...]
alteran from dir <project-dir> <command> [args...]
```

This command means:

- resolve the target context explicitly;
- initialize the target if needed;
- construct a fresh Alteran execution context for that target;
- then interpret the remaining arguments exactly as an ordinary `alteran <command> ...` invocation inside that target context.

### `from app`

`alteran from app <name> ...` resolves `<name>` as a registered app in the current active Alteran project.

It is therefore an active-project-aware rebasing command:

- it requires an active owning project;
- it uses the owning project's registry/config knowledge to resolve the app;
- if the target app/project context is not yet initialized, Alteran should automatically perform the equivalent of target-local `setup` first;
- it then executes the requested Alteran subcommand from the rebased app/project context.

### `from dir`

`alteran from dir <project-dir> ...` resolves `<project-dir>` as an explicit Alteran project directory.

It is a directory-targeted rebasing command:

- it does not use `deno.json` as an Alteran context anchor;
- it must resolve Alteran project markers from the target directory;
- if the target project is not yet initialized, Alteran should automatically perform the equivalent of target-local `setup` first;
- it then executes the requested Alteran subcommand from that target project context.

## Relationship to `external`

`from` does not replace `external`.

The distinction is:

- `external` targets a foreign Alteran object through an explicit config-anchor path such as `alteran.json` or `app.json`, but still executes from the caller's current project context;
- `from` targets a foreign Alteran context through a typed selector such as app name or project directory, then reinterprets the remaining command as if Alteran had been entered there first.

Examples:

```text
alteran external ./other-project/alteran.json tool run seed
alteran from dir ./other-project tool run seed
alteran from app hello-cli tool run generate
```

Both remain explicit and visually distinct from ordinary active-project commands.

`external` therefore must not:

- silently become a context switch;
- auto-initialize the target project as if it had been entered;
- write target-owned runtime or canonical logging state into the foreign target.

`from` is the mode that intentionally becomes that target context.

## Consequences

Positive:

- future example-management and repository-maintenance tooling can reuse ordinary Alteran commands instead of inventing ad hoc path flags everywhere;
- cross-context execution remains explicit and hard to confuse with ordinary active-project behavior;
- `from` has predictable semantics even for not-yet-initialized targets because it owns target setup explicitly;
- command composition becomes more uniform for advanced users.

Tradeoffs:

- the command surface becomes slightly larger;
- `from app` depends on an active owning project and cannot be treated as a completely standalone path-only mode;
- `from` may perform a visible first-run setup step before executing the requested command;
- help/docs/tests must clearly explain the distinction between active-project commands, `external`, and `from`.

## Rejected Alternatives

### Extend `external` to cover every cross-context case

Rejected because config-anchor targeting and context rebasing are related but not identical operations, and overloading `external` would make its semantics less clear.

### Let ordinary `app`, `tool`, `task`, or `run` accept foreign app names or project paths

Rejected because it would blur the boundary between normal in-context execution and explicit cross-context execution.
