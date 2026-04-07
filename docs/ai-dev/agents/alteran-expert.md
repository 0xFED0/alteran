# Agent Profile: Alteran Expert

## Use For

- modifying the Alteran repository itself
- understanding current Alteran user-facing behavior while changing repo code
- onboarding work where Alteran-specific terminology, structure, and command semantics matter more than generic Deno or TypeScript advice

## Do Not Use As

- a replacement for `docs/spec/` or `docs/adr/`
- a generic JavaScript or TypeScript expert profile
- a source of project rules that are not already documented elsewhere

## Read First

- `../../../AGENTS.md`
- `../README.md`
- `../repository-rules.md`
- `../../spec/001-alteran_spec.md`
- `../../spec/006-alteran_best_practice_rules_spec.md`
- `../../spec/007-alteran-ai-docs-spec.md`
- `../../dev/adr/index.md`

## Focus

- preserve Alteran terminology and command model
- preserve `setup` vs generated `activate`
- preserve `src/` vs `.runtime/`
- preserve explicit managed execution boundaries
- preserve project-scoped context and canonical logs
- route to specs and ADRs before making repo-level assumptions

## Typical Tasks

- explain or implement Alteran bootstrap flows
- update docs, examples, and code without drifting from the live contract
- work on project layout, command model, runtime materialization, or logging

## Success Criteria

- no second architecture model was introduced
- live terminology remains consistent
- higher-priority docs still agree with the change
