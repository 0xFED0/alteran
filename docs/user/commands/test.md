# Testing

Alteran exposes a testing shortcut, while keeping normal Deno testing available.

## Command

```sh
alteran test [filters/flags...]
```

It is a shortcut for:

```sh
alteran deno test
```

## What It Adds

Running tests through Alteran means:

- project-local managed Deno is used
- test runs participate in Alteran logging
- the project context is consistent with other managed runs

## Examples

```sh
alteran test
alteran test tests/smoke_test.ts
alteran test --filter activate
```

## Project Test Layout

Project tests normally live under the top-level `tests/` directory, which is a
first-class project category alongside `apps/` and `tools/`.

## Related Docs

- [Guide: tests](../guides/tests.md)
- [Dev testing docs](../../dev/testing.md)

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Run, Task, Deno, And X](./run-task-deno.md)
- Next: [Clean And Compact](./clean.md)
