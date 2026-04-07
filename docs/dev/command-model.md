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

## Scope Boundary

Commands are split between:

- external-project commands such as `setup [dir]`
- active-project commands such as `refresh`, `app ...`, `tool ...`, and
  `compact`

Cross-project execution is explicit through `alteran external ...`, not a
hidden second mode of ordinary commands.

## Why This Matters

- help output stays teachable
- future expansion stays coherent
- project mutation scope stays obvious

## Shell Alias Model

Alteran provides:

- fixed convenience aliases such as `alt`, `arun`, `atask`, `atest`, `ax`,
  and `adeno`
- entry-scoped `shell_aliases` for apps and tools
- a separate top-level `shell_aliases` map for arbitrary shell shortcuts

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Runtime Materialization](./runtime-materialization.md)
- Next: [Config Sync](./config-sync.md)
