# ADR 0019: Use a Root Invocation Log Tree with Child Process Aggregation

## Status

Accepted

## Context

Alteran needs process logging that preserves parent/child relationships without exploding into a forest of unrelated top-level per-process log directories.

The logging model should make it easy to inspect one root invocation as a coherent execution tree.

## Decision

Alteran logs are organized by root invocation category and root invocation directory. Child processes do not create their own top-level run directories. Instead:

- child stdout/stderr are captured into the root invocation’s `stdout.log` and `stderr.log`
- child lifecycle and trace data are recorded in the root invocation’s `events.jsonl`

The canonical root invocation directory always remains under the current project's `.runtime/logs/...`, even if Alteran later mirrors/copies logs to an external custom location.

## Consequences

Positive:

- one root call corresponds to one primary inspection location
- parent/child relationships remain visible in structured events
- the system avoids excessive directory fragmentation

Tradeoffs:

- text logs may contain interleaved child output

## Rejected Alternatives

### Create a separate top-level log directory for every child process

Rejected because it scatters one invocation tree across many places.
