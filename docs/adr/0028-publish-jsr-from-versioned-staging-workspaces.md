# ADR 0028: Publish JSR from Versioned Staging Workspaces and Default to the Current Version

## Status

Accepted

## Context

Alteran stages publication outputs under versioned directories such as `dist/jsr/<version>/`.

`deno publish` requires the package config being published to belong to a workspace. Publishing directly from the repository root would weaken isolation between authored repository state and prepared release payloads.

Alteran also needs a small, explicit publication tool for repeatable local publishing and CI publishing.

## Decision

Alteran publishes JSR packages from the prepared versioned staging directory itself:

- `dist/jsr/<version>/`

Each prepared JSR directory is treated as a tiny self-contained publish workspace and therefore contains:

- `jsr.json`
- a local `deno.json` with `workspace: ["."]`

Alteran provides a dedicated `publish_jsr` tool.

Its version-selection contract is:

- no `--version` means `current`
- `--version current` prepares and publishes the current repository version
- `--version latest` publishes the latest already-prepared staged version
- `--version <x.y.z>` publishes a specific already-prepared staged version

Token handling is explicit but flexible:

- `--token <token>` overrides environment
- `JSR_TOKEN` is the preferred environment variable
- `ALTERAN_JSR_TOKEN` remains an Alteran-specific fallback
- if no token is supplied, interactive publication is allowed

## Consequences

Positive:

- JSR publication is isolated from unrelated repository files
- local dry-runs and real publishes use the same prepared payload
- CI can publish through the same `publish_jsr` flow as local developers
- release zips can continue to be derived from the same staged JSR payload

Tradeoffs:

- prepared publication directories now contain an extra local `deno.json`
- publication is intentionally a staged multi-step workflow rather than a one-shot root publish

## Rejected Alternatives

### Publish directly from the repository root

Rejected because it couples publication to the repository workspace too tightly and weakens the “prepared payload is the source of truth” model.

### Require `--version` on every publish

Rejected because the normal publish case is “publish the current repository version”, so making the flag optional keeps the common path simpler without hiding the behavior.
