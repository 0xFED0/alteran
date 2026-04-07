# Run, Task, Deno, And X

Alteran exposes several execution routes on purpose. They are similar, but they
are not interchangeable.

## Command Summary

```sh
alteran run <file> [args...]
alteran task <name> [args...]
alteran deno <args...>
alteran x <module> [args...]
```

## Which One To Use

- `alteran run`: run a script file with Alteran-managed Deno and preinit
- `alteran task`: run a root Deno task inside the Alteran environment
- `alteran deno`: pass raw Deno arguments through the Alteran environment
- `alteran x`: run a remote module inside the Alteran-managed environment

## Managed vs Plain

Managed execution adds:

- Alteran runtime context variables
- log session creation
- project-local Deno resolution
- preinit for managed script execution paths

Plain `deno run` and plain `deno task` remain plain Deno.

## Practical Rule

Use:

- `deno ...` when you explicitly want plain Deno
- `alteran ...` when you want project-managed runtime, context, and logging

## Related Docs

- [Concepts](../concepts.md)
- [Managed vs plain example](../../../examples/04-managed-vs-plain-deno/README.md)
- [Logging guide](../guides/logging.md)

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Tool Commands](./tool.md)
- Next: [Testing](./test.md)
