# Skill: Command Surface And Terminology

## Use When

- adding, removing, renaming, or documenting commands
- changing command help, CLI docs, examples, or tests
- touching aliases, external-project execution, or command vocabulary

## Read First

- `../../spec/001-alteran_spec.md`
- `../../spec/005-alteran_documentation_spec.md`
- `../../spec/006-alteran_best_practice_rules_spec.md`
- `../../adr/0016-explicit-command-surface-over-positional-magic.md`
- `../../adr/0024-opt-in-entry-aliases-and-separate-shell-aliases.md`
- `../../adr/0025-remove-init-and-keep-setup-as-the-only-bootstrap-command.md`
- `../../dev/command-model.md`
- `../repository-rules.md`

## Steps

1. Confirm whether the change is command contract, alias UX, help wording, or documentation terminology.
2. Keep command surfaces explicit rather than reviving positional magic or hidden second modes.
3. Keep current live vocabulary: `setup`, `shellenv`, `external`, `shell_aliases`.
4. Do not reintroduce legacy command names such as `init`.
5. When command behavior changes, update spec, docs, tests, and AI overlays in sync.

## Done Checklist

- [ ] Help, docs, tests, and examples use the same live command names.
- [ ] No hidden compatibility wording makes legacy commands look preferred.
- [ ] Explicit external-project boundaries remain explicit.
