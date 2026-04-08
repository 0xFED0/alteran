# Command Model

Alteran favors an explicit command surface over positional magic.

## Command Families

- setup/bootstrap
- refresh/sync
- app management
- tool management
- managed execution
- testing
- cleanup
- runtime/version maintenance
- explicit external-project execution
- explicit context-rebased execution

## Scope Boundary

Commands are split between:

- external-project commands such as `setup [dir]`, `shellenv [dir]`, `compact [dir]`, and `compact-copy <destination> [--source=...]`
- active-project commands such as `refresh`, `app ...`, `tool ...`, `clean`, and the no-argument form of `compact`
- explicit rebasing commands such as `from app <name> <command> ...` and `from dir <project-dir> <command> ...`

Cross-project execution is explicit through commands such as `alteran external ...` and `alteran from ...`, not a hidden second mode of ordinary commands.

The distinction is important:

- `alteran external ...` operates on the target from the caller's current Alteran context
- `alteran from ...` rebases execution into the target context and may auto-run target-local setup first if the target is not initialized yet

Valid external context anchors are explicit Alteran-owned config files such as `alteran.json` and `app.json`. `deno.json` is not treated as an Alteran context anchor.

## Why This Matters

- help output stays teachable
- future expansion stays coherent
- project mutation scope stays obvious

## Shell Alias Model

Alteran provides:

- fixed convenience aliases such as `alt`, `arun`, `atask`, `atest`, `ax`, and `adeno`
- entry-scoped `shell_aliases` for apps and tools
- a separate top-level `shell_aliases` map for arbitrary shell shortcuts

User-visible aliases should stay explicit in config rather than hidden behind implicit generation rules.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Runtime Materialization](./runtime-materialization.md)
- Next: [Config Sync](./config-sync.md)
