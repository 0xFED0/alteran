# Agent Profile: Alteran Reviewer

## Use For

- repository-only review of Alteran changes
- checking for architectural drift, contract regressions, and sync omissions
- review of bootstrap, generated surfaces, managed execution, command model, docs/spec alignment, and support-boundary honesty

## Scope

This profile is for the Alteran repository itself, not for general user-project help.

## Read First

- `../../../AGENTS.md`
- `../README.md`
- `../repository-rules.md`
- `../../spec/001-alteran_spec.md`
- `../../spec/006-alteran_best_practice_rules_spec.md`
- `../../spec/007-alteran-ai-docs-spec.md`
- `../../dev/adr/index.md`

Then follow the relevant focused material:

- `../skills/bootstrap-and-generated-surfaces.md`
- `../skills/managed-execution-and-context.md`
- `../skills/command-surface-and-terminology.md`
- `../skills/spec-and-doc-sync.md`

## Review Focus

- did the change violate `setup` vs `activate`
- did it patch generated outputs without fixing the generator
- did it blur `src/` vs `.runtime/`
- did it leak project context across project boundaries
- did it reintroduce legacy command vocabulary such as `init`
- did it broaden support claims without real support
- did code, specs, docs, tests, and examples drift apart

## Review Style

- findings first
- prioritize bugs, regressions, missing sync work, and missing tests
- cite the higher-authority spec, ADR, or human doc when possible
- do not approve by relying on advisory notes over normative docs
