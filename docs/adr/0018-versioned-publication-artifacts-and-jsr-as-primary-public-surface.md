# ADR 0018: Use Versioned Publication Artifacts and Treat JSR as the Primary Public Surface

## Status

Accepted

## Context

Alteran needs a controlled publication workflow that avoids accidental publishing of unrelated repository files and produces reproducible, inspectable release contents.

## Decision

Publication artifacts are prepared under versioned directories:

- `dist/jsr/<version>/`
- `dist/zips/<version>/`

The JSR package is the primary public distribution surface. Archive artifacts may be derived from the same staged publication payload for GitHub Releases or similar channels.

When preparing archive/release artifacts, public bootstrap files such as `setup` / `setup.bat` are part of the releasable payload. Generated local activation artifacts such as `activate` / `activate.bat` are not.

## Consequences

Positive:

- publication contents become explicit and auditable
- reproducible publishing is easier to validate
- archive artifacts can be derived from one controlled payload

Tradeoffs:

- publication tooling needs a deliberate staging step

## Rejected Alternatives

### Publish directly from repository root

Rejected because it weakens reproducibility and increases leakage risk.
