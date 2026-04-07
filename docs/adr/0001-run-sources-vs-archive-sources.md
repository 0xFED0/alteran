# ADR 0001: Separate Runnable Bootstrap Sources from Materialization Sources

## Status

Accepted

## Context

Alteran currently supports two bootstrap source classes:

- `ALTERAN_RUN_SOURCES`
- `ALTERAN_ARCHIVE_SOURCES`

Historically, runnable sources were used both:

- to start Alteran when no local runtime was available
- and to materialize `.runtime/alteran` by recursively invoking
  a nested remote bootstrap command against the same source

This caused architectural and operational problems:

- runnable HTTP/raw sources are good execution entrypoints, but they are not a
  reliable installation/materialization format
- recursive nested bootstrap via runnable sources can re-enter source
  resolution and lead to bootstrap loops
- materializing from a runnable source encourages hacks such as maintaining an
  explicit file manifest for remote self-copy
- a raw GitHub source may be executable by Deno, but that does not mean it is a
  good canonical source for reconstructing the full Alteran runtime layout

At the same time, archives are a better fit for installation because they are
expected to contain a complete, stable, self-contained file set.

## Decision

Alteran should treat bootstrap source classes as having different roles:

- `ALTERAN_RUN_SOURCES` are for execution/bootstrap only
- `ALTERAN_ARCHIVE_SOURCES` are for runtime materialization/install only

More specifically:

1. If Alteran is already running and has local authored source material
   available, `setup`/normal bootstrap should materialize from that
   local source first.
2. If a local materialized runtime already exists, it may be reused.
3. If Alteran needs a canonical source to reconstruct `.runtime/alteran`, it
   should prefer archive sources rather than runnable sources.
4. Runnable sources may still be used to obtain a temporary executable Alteran
   process when nothing local exists yet, but they should not be treated as the
   canonical source for materialization.
5. Remote update semantics belong to `upgrade`, not to ordinary bootstrap or
   `setup`.

## Consequences

Positive:

- removes bootstrap recursion conceptually rather than patching around it
- makes source roles easier to reason about
- makes raw/HTTP runnable sources valid bootstrap entrypoints without requiring
  them to double as installation bundles
- keeps installation semantics aligned with complete release artifacts such as
  zip archives

Tradeoffs:

- a runnable source alone is no longer sufficient as the canonical
  materialization source
- publish/release flows should ensure that archive sources exist for full
  install/bootstrap scenarios
- current stopgap mechanisms that try to materialize directly from remote
  runnable bundles should be considered transitional and removable

## Rejected Alternatives

### Use runnable sources for both execution and materialization

Rejected because it blurs two different responsibilities and creates recursion
and completeness problems.

### Maintain a hand-written manifest of files to copy from a remote runnable bundle

Rejected as a long-term design because it is brittle and duplicates the authored
source tree structure manually.

### Bundle the entire runtime into one generated JavaScript/TypeScript file

Possible, but rejected for now because it adds significant packaging complexity
and moves Alteran farther away from its authored-source-oriented layout.
