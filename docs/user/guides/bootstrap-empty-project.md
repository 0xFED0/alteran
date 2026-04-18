# Bootstrap An Empty Project

This guide focuses on the first-run story: turning an empty or near-empty directory into a usable Alteran project.

It also covers an important part of the product story that is easy to miss at first glance: `setup` is a project bootstrap surface, not something that only exists for the Alteran repository checkout.

## Public Bootstrap Path

```sh
mkdir hello-alteran
cd hello-alteran
curl -fsSL https://github.com/0xFED0/alteran/releases/download/v0.1.9/setup-v0.1.9 | sh -s -- .
source ./activate
```

This is the shortest public Unix bootstrap path and does not require a global
Deno install up front.

For the full list of setup launch paths, including Windows `setup.bat`, Deno
package entry, and repository-local `./setup <dir>`, see
[Setup Launch Methods](./setup-launch-methods.md).

## Repository-Local Equivalent

From the Alteran source repository root:

```sh
./setup ./my-project
source ./my-project/activate
```

This matters for two reasons:

- it lets you bootstrap another directory directly, including an empty one
- it still works as the project bootstrap story when the target machine does not yet have Deno installed globally

## What Setup Creates

- root project structure: `apps/`, `tools/`, `libs/`, `tests/`
- `alteran.json`
- `deno.json`
- local activation files
- `.runtime/` with Alteran runtime and managed Deno
- a managed `.gitignore` block
- a project folder that can later be copied elsewhere and restored with `setup`

## What To Observe

- you can run `alteran help` after activation
- `ALTERAN_HOME` points at the project `.runtime/`
- local runtime state is materialized, not copied into your shell profile
- the resulting project folder is meant to be portable: move it, copy it, rerun `setup`, and continue working

## Example

See [01-bootstrap-empty-folder](../../../examples/01-bootstrap-empty-folder/README.md).

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Update, Upgrade, And Use](../commands/update-upgrade-use.md)
- Next: [Setup Launch Methods](./setup-launch-methods.md)
