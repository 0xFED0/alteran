# ADR 0025: Remove `init` and Keep `setup` as the Only Bootstrap Command

## Status

Accepted

## Context

Alteran has already moved its public bootstrap model from `init` to `setup`.

That shift was reflected in:

- public scripts: `setup` / `setup.bat`
- user-facing bootstrap guidance
- generated activation model
- app-local standalone scaffold creation through `alteran app setup <path>`

However, the codebase still retained pieces of the old naming model:

- backward-compatible CLI aliases such as `alteran init`
- backward-compatible app subcommands such as `alteran app init`
- internal helper names such as `initProject`
- stale documentation references

This created three kinds of problems:

- users could still discover or rely on a legacy command surface that no longer matched the intended product language
- code and docs could drift because both names appeared to remain valid
- contributors and AI systems could accidentally resurrect the old model while trying to preserve compatibility

At this stage, `init` is not a useful compatibility layer. It is only a source of ambiguity.

## Decision

Alteran removes `init` completely from its active command surface and internal bootstrap vocabulary.

### Public command model

The only public top-level bootstrap command is:

- `alteran setup [dir]`

The only public standalone app scaffold command is:

- `alteran app setup <path>`

The following legacy commands are not supported:

- `alteran init`
- `alteran app init`

They should fail explicitly rather than being accepted silently.

### Internal naming

Internal function names, tests, and generated output references should also use `setup` terminology rather than `init` terminology when they refer to the current bootstrap model.

This includes names such as:

- `setupProject`
- `setupStandaloneApp`

rather than legacy `init*` forms.

### Documentation discipline

User docs, developer docs, specs, tests, and generated help must describe only the `setup` command surface for current behavior.

Historical ADRs may still mention earlier design pressure, but current product contracts should not present `init` as a live option.

## Consequences

### Positive

- one bootstrap term instead of two competing ones
- lower chance of accidental reintroduction of legacy behavior
- easier onboarding for users and contributors
- clearer help output, tests, and documentation

### Tradeoffs

- old muscle memory or stale notes using `init` now fail instead of continuing through compatibility aliases
- some historical ADR wording needs explicit interpretation as history rather than current behavior

## Rejected alternatives

### Keep `init` as a permanent alias for convenience

Rejected because it keeps the product language split and encourages further documentation and test drift.

### Remove `init` only from docs but keep compatibility in code

Rejected because hidden compatibility tends to reappear in examples, tests, and AI-generated changes.
