# Config, Context, Execution, And Logging

## Favor Explicit Config Over Hidden Runtime Magic

- If an alias is user-visible, prefer storing it explicitly in config.
- Avoid hidden runtime behavior that users cannot see or predict.
- The `shell_aliases` model is better than boolean flags plus hidden transformations.

## Preserve Existing Entry State On Reimport

Reimport should refresh discovered structure without wiping entry-specific state such as:

- explicit paths
- alias configuration
- user-authored metadata

If discovery rewrites user intent too aggressively, the product becomes hostile.

## Resolve Paths Relative To The Owning Config

- Paths in `alteran.json` are not relative to arbitrary `PWD`.
- App-local config resolves from app context.
- Root config resolves from project root.

## Treat Project Context As Project-Scoped

- `ALTERAN_HOME` and related runtime/logging context belong to one project.
- Entering another project through `setup`, `activate`, `shellenv`, or a generated app launcher should replace foreign inherited context.
- Within one project, child invocations may inherit context; across projects, they should not do so implicitly.

## Keep Cross-Project Execution Explicit

- Normal commands should not secretly target foreign projects.
- If a user wants to operate on another project, it should be obvious:
  - `setup <dir>`
  - `alteran external ...`
- `alteran.json` and `app.json` are explicit external anchors.
- `deno.json` is too ambiguous to be an external Alteran context anchor.

## Keep Managed Execution Explicit

- Plain Deno stays plain.
- Managed behavior belongs to explicit Alteran entrypoints such as `alteran run`, `alteran task`, `alteran app run`, `alteran tool run`, and `alteran test`.
- If a task or launcher accidentally bypasses managed context, treat that as a product bug.

## Keep Canonical Logging Project-Local

- Canonical root lives under `<project>/.runtime/logs/`.
- One root invocation gets one root log directory.
- Child runs aggregate into that root tree.
- Foreign inherited root log dirs should not become authoritative just because they exist.

## Messages Are Part Of The Interface

For bootstrap, activation, refresh, materialization, cleanup, and publication:

- say what failed
- say why that branch failed
- say what the user should try next

Prefer actionable error text over vague summaries like "bootstrap failed".

## Practical Smells

- `ls` output does not match how entries really resolve
- config behavior changes when the caller `cd`s elsewhere
- alias behavior feels magical
- logs land in the wrong project's tree
- tests pass under plain `deno test` but fail under `alteran test`
- help/docs/code disagree about the same command

## Related Source Of Truth

- [ADR 0012](../../adr/0012-single-stable-libs-alias-with-app-local-shadowing.md)
- [ADR 0015](../../adr/0015-managed-execution-uses-preinit-while-plain-deno-stays-plain.md)
- [ADR 0019](../../adr/0019-root-invocation-log-tree-with-child-aggregation.md)
- [ADR 0023](../../adr/0023-project-scoped-execution-context-and-canonical-log-root.md)
- [ADR 0024](../../adr/0024-opt-in-entry-aliases-and-separate-shell-aliases.md)
- [Command Model](../command-model.md)
- [Config Sync](../config-sync.md)
- [Logging](../logging.md)
