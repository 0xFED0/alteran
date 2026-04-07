# ADR 0024: Use Explicit `shell_aliases` for Entries and a Separate Top-Level `shell_aliases` Map

## Status

Accepted

## Context

Alteran already provides a few global convenience aliases such as `alt`, `arun`, `atask`, `atest`, `ax`, and `adeno`, and it can also generate project-local app/tool launch aliases.

However, two different needs must be kept separate:

- entry aliases that belong to a registered app or tool
- arbitrary shell shortcuts that do not represent a registry entry

Mixing both into the same config shape would blur the distinction between:

- stable project entities such as apps and tools
- volatile shell UX conveniences

It would also make alias generation too aggressive if every discovered app/tool always created shell aliases implicitly at runtime.

## Decision

Alteran uses two separate alias mechanisms:

### 1. App/tool entry aliases

Each app or tool registry entry may declare:

- `shell_aliases: ["..."]`

Rules:

- `shell_aliases` is the exact alias list injected for that entry
- these aliases are entry-scoped and conceptually belong to that app/tool
- if an entry is reimported and already exists in registry state, its alias configuration is preserved
- for created or reimported entries whose alias field is absent, Alteran may seed a default first alias such as `app-<name>` / `tool-<name>`
- if `shell_aliases` is present as `[]` or explicit `null`, that disables automatic alias seeding for that entry

For Alteran-created or Alteran-reimported entries, the default behavior may still be “alias-enabled by default”, but that state must be written explicitly into `shell_aliases` rather than being hidden behind a separate boolean flag.

### 2. Top-level shell aliases

Arbitrary shell shortcuts live under a separate top-level config section:

- `shell_aliases`

These aliases:

- are not tied to a specific app or tool registry entry
- are injected only into generated shell environment output
- are convenience UX, not part of command identity or project registry

Example shape:

```json
{
  "shell_aliases": {
    "myrun": "alt run some/script.ts"
  }
}
```

## Consequences

### Positive

- alias ownership is clearer
- app/tool aliases remain attached to real registry entries
- arbitrary shell shortcuts have an explicit and separate home
- reimport can preserve user intent on existing entries
- entry alias behavior becomes explicit and auditable in config

### Tradeoffs

- registry entries become slightly more verbose
- entry alias configuration is slightly more verbose

## Rejected alternatives

### Keep a separate `add_alias` flag plus `aliases`

Rejected because it keeps meaningful alias behavior split across two different fields and makes the generated alias set less transparent to the user.

### Store all aliases in one generic map

Rejected because entry-bound aliases and arbitrary shell shortcuts have different ownership and lifecycle semantics.
