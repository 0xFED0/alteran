# Getting Started

The shortest path into Alteran is:

1. bootstrap a project
2. activate its local environment
3. add an app and a tool
4. run them through Alteran

If you want that walkthrough directly, go to [Quickstart](./quickstart.md). If you want the mental model first, continue with [Concepts](./concepts.md).

## What You Need To Know Early

- `setup` is the public bootstrap surface
- `setup` is meant for projects, not only for the Alteran repository itself
- `activate` is generated locally and is meant to enter the shell environment
- `.runtime/` is recoverable local state, not authored source-of-truth
- `apps/` and `tools/` are both first-class project units
- plain `deno` remains plain; `alteran run`, `alteran task`, and `alteran tool run` are the managed execution paths
- a project folder can be moved to another machine and restored there by running `setup` again

That usually means the beginner path is:

1. run `setup`
2. source `activate`
3. create an app or tool
4. run it through `alteran`

The shortest public Unix bootstrap path is:

```sh
curl -fsSL https://github.com/0xFED0/alteran/releases/download/v0.1.10/setup-v0.1.10 | sh -s -- .
```

If you want the full matrix of launch options such as Windows `setup.bat`,
downloaded local `setup`, Deno package entry, or
repository-local `./setup <dir>`, use [Setup Launch Methods](./guides/setup-launch-methods.md).

## Good Companion Docs

- [Concepts](./concepts.md) for the mental model
- [Project Layout](./project-layout.md) for the directory structure
- [Activation](./activation.md) for shell entry behavior
- [Command overview](./commands/overview.md) for the CLI surface
- [Bootstrap guide](./guides/bootstrap-empty-project.md) for the empty-folder story
- [Setup launch methods](./guides/setup-launch-methods.md) for all supported bootstrap entry paths

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [User Docs Overview](./overview.md)
- Next: [Quickstart](./quickstart.md)
