# Skill: Spec And Doc Sync

## Use When

- public behavior changes
- naming, config shape, layout, or command contract changes
- docs and implementation need to stay aligned in one change

## Read First

- `../../spec/001-alteran_spec.md`
- `../../spec/005-alteran_documentation_spec.md`
- `../../spec/006-alteran_best_practice_rules_spec.md`
- `../../spec/007-alteran-ai-docs-spec.md`
- `../../adr/README.md`

## Steps

1. Identify whether the change affects public behavior, architecture, tests, examples, docs, or publication.
2. Update `docs/spec/` first when the contract changed.
3. Update `docs/adr/` in the same change when the decision is architectural or reverses earlier rationale.
4. Update human-facing docs under `docs/user/`, `docs/dev/`, and `docs/reference/`.
5. Update AI overlays such as `AGENTS.md`, repository `llms.txt`, and `docs/ai-dev/` last.
6. Validate the changed flow with the smallest honest command or docs check.

## Done Checklist

- [ ] No new normative rule exists only in AI-oriented docs.
- [ ] Terminology uses current live surfaces such as `setup`, not `init`.
- [ ] Links point to existing docs and ADRs.
- [ ] Support boundaries remain honest.
