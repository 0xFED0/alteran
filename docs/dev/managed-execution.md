# Managed Execution

Managed execution is how Alteran adds project context and logging without
pretending that bare Deno changed semantics.

## Preinit

Managed execution uses:

```text
.runtime/alteran/preinit.ts
```

This file is the preload entrypoint for managed script execution.

## Managed Routes

Current managed routes include:

- `alteran run`
- `alteran task`
- `alteran app run`
- `alteran tool run`
- `alteran test`
- `alteran deno ...` inside the Alteran environment

## Plain Deno Stays Plain

- `deno run`
- `deno task`

remain normal Deno behavior unless you explicitly go through Alteran.

## Environment Context

Managed execution sets project-scoped variables such as:

- `ALTERAN_HOME`
- `ALTERAN_RUN_ID`
- `ALTERAN_ROOT_RUN_ID`
- `ALTERAN_ROOT_LOG_DIR`

That context is valid for nested same-project runs, but not as a shell-global
identity that should leak across projects.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Generated Files](./generated-files.md)
- Next: [Logging](./logging.md)
