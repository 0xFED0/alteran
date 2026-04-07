# Repository Rules

This file is a strict AI-maintainer summary for the Alteran repository.

It is not a higher authority than `docs/spec/` or `docs/adr/`. Its job is to
make mandatory repository constraints hard to miss before editing.

## Read First

- `../spec/001-alteran_spec.md`
- `../spec/006-alteran_best_practice_rules_spec.md`
- `../spec/007-alteran-ai-docs-spec.md`
- `../dev/adr/index.md`

## Hard Rules

- Keep normative architecture in `docs/spec/`, not in AI overlays.
- Keep `setup` as the only live bootstrap command surface. Do not revive
  `init`.
- Keep `setup` separate from generated local `activate`.
- Treat `src/` as authored source-of-truth and `.runtime/` as generated local
  state.
- Fix generators or templates before patching repeated generated outputs.
- Keep managed execution explicit. Plain Deno stays plain unless the route goes
  through Alteran on purpose.
- Keep project context project-scoped. Do not implicitly reuse foreign
  `ALTERAN_*` runtime or logging context across projects.
- Keep cross-project execution explicit through Alteran-owned surfaces rather
  than hidden path tricks or ambient `PWD`.
- Keep canonical logs project-local under `.runtime/logs/`.
- Use archive sources for installation/materialization and run sources only for
  execution bootstrap.
- Keep support claims honest. GNU-based Linux is in scope; Alpine/musl is not
  a supported runtime target today.
- Do not turn advisory docs or AI notes into a second architecture source.

## File Ownership Rules

- `src/` is authored source.
- `.runtime/` is generated local state.
- `setup` / `setup.bat` are public bootstrap surfaces and may be generated but
  intentionally tracked.
- `activate` / `activate.bat` are generated local artifacts.
- `dist/` is publication output.
- examples, tests, and docs fixtures must remain honest about what they are.

## Sync Rules

- If public behavior, naming, layout, config shape, tests, or publication
  contract changes, update `docs/spec/` first.
- If the change is architectural or reverses prior rationale, update
  `docs/adr/` in the same change.
- Update `docs/user/`, `docs/dev/`, and `docs/reference/` before or alongside
  AI overlays.
- Update `AGENTS.md`, `.github/copilot-instructions.md`, repository `llms.txt`,
  and `docs/ai-dev/` last.

## Stop And Recheck If

- a fix seems to require reviving `init`
- the easiest patch edits generated outputs but not the generator
- a bootstrap fix starts making `activate` smarter instead of fixing `setup`
- a change relies on foreign inherited Alteran env across projects
- docs, examples, tests, and code no longer describe the same command surface
