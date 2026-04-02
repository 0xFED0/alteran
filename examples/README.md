# Alteran Examples

This directory is the runnable example gallery for Alteran.

The examples are intentionally kept as source-first trees:

- committed files show the authored project shape;
- public `setup` / `setup.bat` are tracked bootstrap entrypoints;
- generated `activate` / `activate.bat` and `.runtime/` are materialized
  locally.

Managed project examples in this repository also include a small committed
`.env` file that points `ALTERAN_SRC` at the repository `src/` tree. That keeps
`./setup` local and inspectable when you run an example from this checkout.

## Core examples

1. `01-bootstrap-empty-folder`
2. `02-multi-app-workspace`
3. `03-tools-workspace`
4. `04-managed-vs-plain-deno`
5. `05-logging-run-tree`
6. `06-refresh-reimport`
7. `07-compact-transfer-ready`

## Advanced examples

- `advanced/logtape-categories`
- `advanced/standalone-app-runtime`

## Typical in-repo workflow

From inside a managed example directory:

```sh
./setup
source ./activate
```

For examples that evolve after setup, continue with the commands shown in the
example README.

Standalone app examples document their own app-local `setup` / launcher flow.

From the repository root, a public bootstrap path is also valid:

```sh
./setup ./examples/02-multi-app-workspace
source ./examples/02-multi-app-workspace/activate
```
