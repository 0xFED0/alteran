# Using Tests In A Project

Alteran projects treat `tests/` as a first-class top-level category.

## Typical Layout

```text
tests/
  smoke_test.ts
```

## Run Tests

Managed route:

```sh
alteran test
```

Plain Deno route:

```sh
deno test -A
```

Use the managed route when you want test runs to participate in Alteran's local
runtime and logging context.

## Good Practice

- keep project tests under the root `tests/`
- use examples for teaching runnable flows
- use tests to lock user-facing behavior and regressions

## Developer Context

For Alteran repository testing strategy itself, see [dev/testing.md](../../dev/testing.md).

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Shared Libraries](./shared-libs.md)
- Next: [Standalone Apps](./standalone-apps.md)
