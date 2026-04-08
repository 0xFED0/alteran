# Skill: Bootstrap And Generated Surfaces

## Use When

- changing `setup`, `setup.bat`, `activate`, `activate.bat`, or app launcher surfaces
- touching bootstrap templates or generated script behavior
- fixing drift between generator logic and committed bootstrap files
- changing the committed examples reset flow or the baseline of tracked example bootstrap files

## Read First

- `../../spec/001-alteran_spec.md`
- `../../spec/006-alteran_best_practice_rules_spec.md`
- `../../adr/0022-separate-setup-from-activate-and-generate-activation-locally.md`
- `../../adr/0010-minimal-shell-bootstrap-and-typescript-owned-logic.md`
- `../../dev/generated-files.md`
- `../../dev/runtime-materialization.md`
- `../repository-rules.md`

## Steps

1. Identify whether the change belongs to public bootstrap, generated local activation, or launcher behavior.
2. Update the generator or template source first.
3. Keep `setup` responsible for bootstrap, repair, materialization, and source selection.
4. Keep generated `activate` narrow, absolute-path-based, and sourced-only on Unix.
5. Regenerate or resync any committed bootstrap outputs affected by the generator change.
6. If repository examples depend on the touched bootstrap surface, update or rerun `examples/reset.ts`.
7. Recheck docs, examples, and tests that describe the touched surface.

## Done Checklist

- [ ] `setup` and generated `activate` responsibilities remain separate.
- [ ] No fix relies on smarter activation instead of correct setup logic.
- [ ] Generator and generated outputs are back in sync.
- [ ] Repository examples can still be restored to baseline through `examples/reset.ts`.
- [ ] Current docs and tests still describe the live bootstrap contract.
