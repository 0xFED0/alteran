# User Docs Overview

If you want to use Alteran in your own project, start here.

Alteran gives a Deno-based project:

- public bootstrap entrypoints: `setup` and `setup.bat`
- generated local activation entrypoints: `activate` and `activate.bat`
- a project-local managed Deno runtime under `.runtime/`
- first-class `apps/`, `tools/`, `libs/`, and `tests/`
- managed execution with logging and context injection
- a portable project folder that can be copied to another machine and restored by running `setup`

That portability is a core reason Alteran keeps the runtime local to the project instead of assuming one global installation on every machine.

Alteran is not a desktop framework, not an IPC framework, and not a replacement for plain Deno. `view/` exists as a reserved extension point, but it is not the center of the current product story.

## Read This Next

- [Getting Started](./getting-started.md)
- [Quickstart](./quickstart.md)
- [Concepts](./concepts.md)
- [Project Layout](./project-layout.md)
- [Activation](./activation.md)
- [Command overview](./commands/overview.md)
- [Portable AI user bundle](../ai-user/README.md)
- [Examples](../../examples/README.md)

## Navigation
- Home: [Docs Index](../README.md)
- Next: [Getting Started](./getting-started.md)
