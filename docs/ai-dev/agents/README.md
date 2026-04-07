# Agent Profiles

This directory defines reusable Alteran-specific agent profiles for repository work.

These profiles are operational overlays, not higher-authority sources. They must route work back to `docs/spec/`, `docs/adr/`, and the normal docs tree.

## Available Profiles

- `alteran-expert.md` - general Alteran specialist for repository work and for understanding Alteran user behavior
- `alteran-reviewer.md` - repository-only reviewer focused on catching architectural drift, contract regressions, and missing sync updates

## Rules

- Profiles must not invent new architecture or product rules.
- Profiles must state where they apply and where they do not.
- Profiles must reference the canonical docs they rely on.
- Reviewer-style profiles should prioritize findings over summaries.
