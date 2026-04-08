# ADR 0030: Keep the JSR Package Lean and Put Full Docs Only in Release Zips

## Status

Accepted

## Context

Alteran prepares a staged publication directory under `dist/jsr/<version>/` and may derive a release zip under `dist/zips/<version>/`.

The JSR package page already renders the package `README.md`, while links inside that README resolve to repository-hosted documentation pages.

Copying the full `docs/` tree into the JSR package therefore duplicates content without improving the practical JSR experience enough to justify the larger staged package.

Release zip artifacts are different. They are intended as portable downloadable bundles, so including the full `docs/` tree there is useful and aligned with the release/distribution story.

## Decision

Alteran uses two distinct publication surfaces.

### JSR package surface

The staged JSR package under `dist/jsr/<version>/` includes:

- `alteran.ts`
- `setup`
- `setup.bat`
- `README.md`
- `src/`
- generated `jsr.json`
- publication-local `deno.json`

It does not include the full `docs/` tree.

### Release zip surface

The release zip under `dist/zips/<version>/` is derived from the staged JSR payload, but it additionally includes the repository `docs/` tree before archiving.

Publish-only metadata such as the publication workspace `deno.json` and `jsr.json` is not carried into the release zip.

## Consequences

- JSR publication stays lean and focused on the actual package surface.
- JSR still exposes useful package documentation through `README.md` and JSR-generated API docs.
- Release zip artifacts remain richer portable bundles suitable for offline or transferred use.
- `prepare_jsr` and `prepare_zip` intentionally produce different payloads instead of treating the zip as a byte-for-byte archive of the staged JSR directory.
- archive/bootstrap use of release zips is not polluted by JSR publish-only workspace metadata

## Rejected Alternative

### Put `docs/` into both JSR and release zip

Rejected because it duplicates documentation into the JSR package without adding meaningful value when JSR already renders `README.md` and repository links resolve to GitHub-hosted documentation.
