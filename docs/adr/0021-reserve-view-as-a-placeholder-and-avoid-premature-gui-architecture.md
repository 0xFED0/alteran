# ADR 0021: Reserve `view` as a Placeholder and Avoid Premature GUI Architecture

## Status

Accepted

## Context

Alteran is expected to support future GUI/view-related work, but the current
project focus is runtime management, scaffolding, and execution flows.
Over-specifying `view` too early would force architectural commitments before
real requirements exist.

## Decision

Alteran reserves `view/` and the conceptual `view` task as first-class
placeholders, but intentionally leaves GUI/view architecture under-specified for
now.

Alteran explicitly avoids becoming a desktop framework, IPC framework, or native
host platform in the current iteration.

## Consequences

Positive:

- future work has an intentional extension point
- current implementation stays focused on runtime and project-management core

Tradeoffs:

- some future-facing parts remain intentionally vague

## Rejected Alternatives

### Fully design the GUI/view subsystem now

Rejected because requirements are not mature enough and premature architecture
would likely calcify the wrong abstractions.
