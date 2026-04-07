# ADR 0014: Materialize and Cache Runtime Locally Instead of Running It Remotely on Every Invocation

## Status

Accepted

## Context

Alteran supports remote bootstrap sources and publication artifacts, but normal project use must remain stable, reproducible, and independent of constant remote availability.

Executing core runtime code directly from remote URLs on every run would make ordinary operation fragile and harder to inspect or debug.

## Decision

Remote sources may be used during bootstrap, update, or controlled acquisition flows. Regular Alteran operation runs against locally materialized runtime files under `.runtime/` rather than re-fetching or re-executing remote modules on every invocation.

## Consequences

Positive:

- day-to-day operation is reproducible and less network-dependent
- local runtime state is inspectable and debuggable

Tradeoffs:

- Alteran must maintain explicit installation/materialization logic

## Rejected Alternatives

### Execute Alteran directly from remote runnable sources on every run

Rejected because it undermines local reproducibility and operational stability.
