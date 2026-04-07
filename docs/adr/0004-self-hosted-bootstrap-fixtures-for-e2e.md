# ADR 0004: Use Self-Hosted Bootstrap Fixtures for Remote Bootstrap Tests

## Status

Accepted

## Context

Alteran bootstrap behavior depends on source classes such as:

- runnable sources
- archive sources

End-to-end tests need to verify these flows without depending on public network
availability or third-party hosting semantics.

At the same time, remote-source tests must still behave like real network
bootstrap, including:

- HTTP URLs
- archive download paths
- containerized access patterns

Public network fixtures are too flaky and too hard to control for this purpose.

Docker environments also introduce host-specific bind-mount constraints, for
example when system temp directories are not shared into the container runtime.

## Decision

Alteran remote bootstrap tests should use locally generated, self-hosted
fixtures.

Specifically:

1. Tests should generate a local runnable bundle from repository content.
2. Tests should generate a local archive bundle from repository content.
3. Tests should serve those fixtures from a local HTTP server under test
   control.
4. Docker tests should consume the same class of locally generated fixtures.
5. Docker bind-mounted fixture directories should use repository-controlled
   shared paths when needed for container compatibility.

## Consequences

Positive:

- remote bootstrap tests stay deterministic
- runnable and archive flows can be tested without external infrastructure
- failures are easier to classify as product bugs versus harness problems
- Docker tests are less sensitive to host-specific mount behavior

Tradeoffs:

- test support code becomes more sophisticated
- fixture MIME types, bind mounts, and serving behavior must be maintained
  carefully

## Rejected Alternatives

### Use public remote URLs in bootstrap tests

Rejected because it introduces flakiness and weakens reproducibility.

### Test only local file bootstrap and skip HTTP bootstrap

Rejected because HTTP bootstrap behavior is an important real-world scenario.
