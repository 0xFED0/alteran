# Copilot Instructions

Use [../AGENTS.md](../AGENTS.md) as the main repository-level routing file.

## Source Of Truth

When guidance overlaps, follow this order:

1. `docs/spec/`
2. `docs/adr/`
3. `docs/user/`, `docs/dev/`, and `docs/reference/`
4. `AGENTS.md`
5. this file
6. `docs/ai-dev/`

## Read First

When modifying Alteran itself, start with:

- `docs/spec/001-alteran_spec.md`
- `docs/spec/006-alteran_best_practice_rules_spec.md`
- `docs/spec/007-alteran-ai-docs-spec.md`
- `docs/dev/overview.md`
- `docs/dev/adr/index.md`

## Operational Rules

- Keep this file short and tool-specific.
- Do not define public behavior, config schema, or architecture here.
- Keep `setup` as the only live bootstrap surface. Do not revive `init`.
- Keep `setup` separate from generated local `activate`.
- Treat `src/` as authored source and `.runtime/` as generated local state.
- Fix generators/templates before patching repeated generated outputs.
- Keep project context project-scoped and cross-project work explicit.

## Validation

For docs-only changes, verify links, filenames, and terminology.

For repository behavior changes, use the smallest honest validation, for
example:

```sh
./setup
source ./activate
alteran test -A
```
