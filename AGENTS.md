# AGENTS.md

## Project Summary

Alteran is a project-local runtime and scaffold manager for Deno automation
projects.

The repository has a strict split between:

- authored source in `src/`
- generated local runtime state in `.runtime/`
- public bootstrap surfaces such as `setup` / `setup.bat`
- generated local activation surfaces such as `activate` / `activate.bat`

This file is a routing overlay for coding agents. It does not replace the
numbered specs, ADRs, or normal docs.

## Source Of Truth

Use this precedence order when documents overlap:

1. `docs/spec/001-alteran_spec.md` and the rest of `docs/spec/`
2. `docs/adr/`
3. `docs/user/`, `docs/dev/`, and `docs/reference/`
4. this file
5. `docs/ai-dev/`

Read these first when changing Alteran itself:

- `docs/spec/001-alteran_spec.md`
- `docs/spec/006-alteran_best_practice_rules_spec.md`
- `docs/spec/007-alteran-ai-docs-spec.md`
- `docs/dev/overview.md`
- `docs/dev/adr/index.md`

Then follow the relevant focused docs:

- ai-dev index: `docs/ai-dev/README.md`
- agent profiles: `docs/ai-dev/agents/README.md`
- hard maintainer summary: `docs/ai-dev/repository-rules.md`
- bootstrap/runtime: `docs/dev/runtime-materialization.md`
- command surface: `docs/dev/command-model.md`
- generated files: `docs/dev/generated-files.md`
- managed execution and logging: `docs/dev/managed-execution.md`,
  `docs/dev/logging.md`
- contributor guardrails: `docs/dev/best-practices/README.md`

If you are acting as an Alteran user rather than a maintainer, start with:

- `docs/ai-user/AGENTS.md`
- `docs/user/overview.md`
- `docs/user/getting-started.md`
- `docs/user/quickstart.md`
- `docs/reference/cli.md`

## Rules

- Keep normative architecture in `docs/spec/`, not here.
- Keep `setup` as the only live bootstrap command surface. Do not revive
  `init`.
- Keep `setup` separate from generated local `activate`.
- Treat `src/` as authored source-of-truth and `.runtime/` as generated local
  state.
- Fix generators and templates before patching repeated generated outputs.
- Keep managed execution explicit. Plain `deno run` and `deno task` stay plain
  unless the route explicitly goes through Alteran.
- Treat project context and canonical logs as project-scoped. Do not let
  foreign Alteran context leak across projects implicitly.
- Use archive sources for installation/materialization. Runnable sources are
  for execution bootstrap only.
- Keep support claims honest. GNU-based Linux is in scope; Alpine/musl is not
  currently a supported runtime target.
- Prefer existing human docs over inventing new AI-only rules.
- Use `docs/ai-dev/skills/` only for repeated workflows, not for unique
  architecture rules.

## Do Not

- do not create a second architecture model or a shadow spec tree
- do not hide user-visible behavior behind undocumented magic
- do not treat `deno.json` as an Alteran external-project anchor
- do not move heavyweight project configuration through environment variables
- do not present temporary workarounds as the preferred long-term model
- do not weaken specs, ADRs, or support boundaries for convenience

## Validation

Pick the smallest honest validation that matches the change.

For docs-only routing changes:

- verify links, filenames, and terminology
- ensure guidance still points back to `docs/spec/`, `docs/adr/`, and normal
  docs

For repository behavior changes, common local commands are:

```sh
./setup
source ./activate
alteran test -A
alteran test -A tests/alteran_unit_test.ts
alteran test -A tests/alteran_e2e_test.ts
```

## Change Policy

- If public behavior, layout, naming, config shape, testing contract, or
  publication contract changes, update `docs/spec/` first.
- If the change is architectural or reverses an earlier decision, update
  `docs/adr/` in the same change.
- Then update `docs/user/`, `docs/dev/`, and `docs/reference/`.
- Update AI overlays such as this file, repository `llms.txt`, and
  `docs/ai-dev/` last.
