# Testing

Alteran testing is guided by product specs, examples specs, and ADRs rather than implementation convenience alone.

## Main Test Categories

- unit tests
- repository-level end-to-end tests
- Windows-specific end-to-end tests
- Docker end-to-end tests
- examples tests
- docs quick start tests

## Repository Tasks

Expected developer tasks include:

- `test:unit`
- `test:e2e`
- `test:windows`
- `test:docker`
- `test`

## Testing Principles

- specification-first behavior
- signal over greenness
- user-centered scenarios
- deterministic fixtures where practical
- honest platform scope
- hermetic execution context
- docs and examples treated as product surfaces

## Important Coverage Areas

- bootstrap from empty or copied setup files
- activation behavior on Unix and Windows
- runtime materialization
- refresh and config synchronization
- standalone app launcher contract
- examples as executable documentation
- project-scoped logging and managed execution boundaries

## Execution Guidance

When testing high-leverage product flows, prefer exercising them through Alteran entrypoints rather than only through plain `deno test`. This helps catch project-context, logging, and managed-execution regressions that plain Deno runs may miss.

## CI Expectations

Repository automation should cover the main supported test surfaces rather than only a single smoke suite.

At minimum, CI should include:

- `deno check` for Alteran source, tools, and test files
- unit tests
- repository e2e tests
- docs/examples tests
- docker e2e tests on Linux
- Windows e2e tests on Windows

In the current repository layout, GitHub Actions workflow files live at the repository root under `.github/workflows/` and target `projects/alteran/`.

## Related Source

- [Test spec](../spec/002-alteran_tests_spec.md)
- [Examples test spec](../spec/004-alteran_examples_test_spec.md)

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Logging](./logging.md)
- Next: [Publication](./publication.md)
