# ADR 0020: Keep LogTape Optional and Integrate It via a Bare-Specifier Proxy

## Status

Accepted

## Context

Alteran wants optional structured application logging support without making LogTape a mandatory dependency or invasive requirement for all projects.

It also needs a controlled bootstrap point when managed execution enables Alteran-side logging behavior.

## Decision

LogTape integration is optional and controlled by `logging.logtape`.

When enabled, Alteran may remap only the bare `@logtape/logtape` import to an internal proxy module under `.runtime/alteran/logging/`, which performs bootstrap/configuration and then re-exports the effective API.

Subpath imports are not implicitly remapped. When LogTape is disabled, the proxy remains effectively inert.

## Consequences

Positive:

- projects that do not use LogTape are not forced into it
- managed execution gets a controlled bootstrap point for structured logging

Tradeoffs:

- import-mapping and proxy semantics must be documented carefully

## Rejected Alternatives

### Make LogTape mandatory

Rejected because it would over-couple Alteran to one logging stack.
