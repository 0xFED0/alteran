# Shared Libraries

Shared project code lives under the root `libs/` directory and is imported
through `@libs/...`.

## Root Shared Libraries

Example:

```text
libs/
  formatting/mod.ts
```

Imported as:

```ts
import { formatReport } from "@libs/formatting";
```

## App-Local Shadowing

Inside app context, Alteran resolves `@libs/...` in this order:

1. `apps/<app>/libs/...`
2. root `libs/...`

This means an app can override a shared library with an app-local version
without rewriting imports.

## Why This Exists

- imports stay stable when code moves between local and shared scope
- exported or moved apps can remain self-contained more easily
- the import path expresses logical ownership, not storage layout

## Related Example

See [02-multi-app-workspace](../../../examples/02-multi-app-workspace/README.md).

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Working With Tools](./working-with-tools.md)
- Next: [Using Tests In A Project](./tests.md)
