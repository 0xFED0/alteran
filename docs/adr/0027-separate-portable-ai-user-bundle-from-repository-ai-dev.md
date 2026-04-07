# ADR 0027: Separate Portable `ai-user` Bundle from Repository-Scoped `ai-dev`

## Status

Accepted

## Context

Alteran now has two different AI-documentation audiences:

- AI assistants working on the Alteran repository itself
- AI assistants helping a user inside some other Alteran-managed project

Those audiences need different packaging properties.

Repository AI docs may safely depend on:

- repository specs
- repository ADRs
- repository dev docs
- repository-specific maintainer rules

User-project AI docs have a different requirement:

- they should be portable
- they should be copyable into another Alteran project
- they should remain useful even after the user customizes them locally
- they should not require the full Alteran repository docs tree to be copied

The previous mixed `docs/ai/` tree made these roles too easy to blur. In practice, a supposedly user-oriented subtree could still depend on repository paths and repository-only context, which weakens portability.

## Decision

Alteran separates AI documentation into two explicit trees:

- `docs/ai-user/` — portable AI bundle for use inside ordinary Alteran projects
- `docs/ai-dev/` — repository-scoped AI docs for changing Alteran itself

### `docs/ai-user/`

This tree is a self-contained portable bundle.

It should contain its own:

- `AGENTS.md`
- `llms.txt`
- `README.md`
- rules
- skills

It must be understandable when copied into another Alteran project without the rest of the Alteran repository docs.

It may summarize current Alteran user-facing behavior, but it must not become the only normative source of that behavior inside the Alteran repository.

### `docs/ai-dev/`

This tree is repository-scoped.

It may depend on repository-local material such as:

- `docs/spec/`
- `docs/adr/`
- `docs/dev/`
- repository-specific maintainer rules and review profiles

It contains repository AI routing, repository rules, Alteran-specific agent profiles, and reusable repository workflows.

### Repository root AI entrypoints

Repository-level entrypoints such as:

- `AGENTS.md`
- `.github/copilot-instructions.md`
- repository `llms.txt`

remain repository-scoped and should route maintainers into `docs/ai-dev/`.

They should not pretend to be portable user-project AI bundles.

## Consequences

### Positive

- portable user AI guidance becomes easy to copy into another project
- repository maintainer AI docs can stay deeply linked to specs and ADRs
- the distinction between “using Alteran” and “changing Alteran” becomes much clearer
- user customization of copied AI docs becomes easier to reason about

### Tradeoffs

- some user-facing guidance must now be summarized twice: once in normal human docs and once in the portable AI-user bundle
- docs maintenance must keep `ai-user`, `ai-dev`, and the normal docs aligned
- navigation must clearly explain which tree is portable and which is repository-scoped

## Rejected Alternatives

### Keep one mixed `docs/ai/` tree

Rejected because it blurs portable user-project guidance with repository-only maintainer guidance.

### Put AI user docs under `docs/user/ai/`

Rejected because it mixes human documentation responsibilities with AI operational overlays and makes portable copying less clean.

### Require users to copy the whole `docs/user/` tree into their projects

Rejected because it is heavier than necessary and does not provide AI-specific entrypoints, rules, and skills in a self-contained package.
