# Project Setup

The command most users should think about here is `setup`.

## Main Commands

```sh
alteran setup [dir]
alteran shellenv [dir] [--shell=sh|batch]
```

## What `setup` Does

`setup` is the user-facing bootstrap and repair path. In practice it:

- creates required project directories
- materializes the Alteran runtime under `.runtime/`
- ensures a project-local managed Deno runtime
- generates `setup`, `setup.bat`, `activate`, and `activate.bat`
- creates or updates `alteran.json`, `deno.json`, and `.gitignore`
- synchronizes discovered apps and tools

If a project was moved, partially cleaned, or entered on a fresh machine,
`setup` is the command that restores it to a working state.

The intended public package form is:

```sh
deno run -A jsr:@alteran setup
```

Inside the Alteran source repository itself, the equivalent bootstrap surface
is the checked-in `./setup` script.

## Target Directory Semantics

- `alteran setup` with no directory targets the current directory
- `alteran setup <dir>` bootstraps another directory explicitly

This is an external-project command by design. It is allowed to target another
directory explicitly because bootstrap and repair are exactly the moments when
you often are not already inside the final project environment.

## What `shellenv` Does

`alteran shellenv` prints dynamic shell code for the current project so that
generated activation files can stay small and computed from current project
state.

Most users do not need to call `shellenv` directly every day. It mainly exists
as the mechanism behind generated activation and other controlled entrypoints.

Typical use is indirect through `activate`, but it can also be called
explicitly:

```sh
eval "$(alteran shellenv)"
```

For Windows batch output:

```bat
alteran shellenv --shell=batch
```

If you only want to start using the project, prefer `setup` and then
`activate`. Reach for `shellenv` when you need explicit shell integration.

## Related Docs

- [Activation](../activation.md)
- [Bootstrap guide](../guides/bootstrap-empty-project.md)
- [Reference CLI](../../reference/cli.md)

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Commands Overview](./overview.md)
- Next: [Refresh And Reimport](./refresh.md)
