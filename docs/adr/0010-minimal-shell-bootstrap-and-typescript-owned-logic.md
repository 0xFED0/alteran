# ADR 0010: Keep Bootstrap Shell Minimal and Put Real Logic in TypeScript

## Status

Accepted

## Context

Bootstrap scripts are necessary because an empty project may begin with only `activate` / `activate.bat`. But once shell logic grows beyond bootstrap duties, it becomes harder to maintain, test, and keep consistent across Unix and Windows.

## Decision

Bootstrap shell scripts remain minimal wrappers.

They may:

- resolve their own location
- resolve the target directory
- detect OS/architecture
- locate or download Deno
- locate/bootstrap Alteran
- invoke environment assurance and activation

Project scaffolding, synchronization, registry management, runtime policy, and other product behavior belong in TypeScript runtime modules, not in shell/batch files.

## Consequences

Positive:

- cross-platform logic stays centralized
- shell scripts are easier to audit and regenerate

Tradeoffs:

- bootstrap still needs a small amount of shell-specific complexity

## Rejected Alternatives

### Encode more project logic in shell and batch files

Rejected because it would duplicate behavior and increase platform drift.
