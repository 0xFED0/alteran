# Activation

Activation is how you enter a project's local Alteran-managed shell environment.

Most of the time the rule is simple:

- run `setup` when you need to bootstrap or repair the project
- use `activate` when you want to enter that project's environment again

## What Activation Does

Generated activation files:

- set `ALTERAN_HOME`
- set `DENO_DIR`
- set `DENO_INSTALL_ROOT`
- put the managed Deno binary directory on `PATH`
- expose the `alteran` command and its convenience aliases
- delegate dynamic shell shaping to `alteran shellenv`

They are intentionally small. They do not own the full bootstrap logic that belongs in `setup`.

## Unix-Like Shells

Use:

```sh
source ./activate
```

Do not rely on executing `./activate` as a regular process. The environment changes need to affect the current shell.

## Windows

Use:

```bat
call activate.bat
```

Batch activation also provides `doskey` aliases such as `alt`, `arun`, `atask`, `atest`, `ax`, and `adeno`.

## Windows PowerShell

Use:

```powershell
. .\activate.ps1
```

PowerShell activation is intended to be dot-sourced into the current session so
that environment variables, functions, and aliases remain available after the
script finishes.

## Relation To Setup

- `setup` is the public bootstrap and repair surface
- `activate` is a local generated artifact tied to one concrete project path and one concrete materialized runtime

That means `activate` is expected to be lightweight. It is for entering the environment, not for re-running full project setup on every shell entry.

If the project is moved or its local runtime becomes invalid, rerun `setup` and regenerate activation.

## Cross-Project Switching

Activation is project-scoped, not shell-global. Entering another project through its `setup`, `activate`, `shellenv`, or generated app launcher replaces foreign inherited Alteran runtime and log context.

## Troubleshooting

- If `activate` is missing, run `setup` again.
- If `activate` says it must be sourced, use `source ./activate`.
- If the project moved on disk, rerun `setup`.
- If commands point at the wrong project, reactivate the intended project.
- If the local runtime looks stale or broken, rerun `setup` and then activate again.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Project Layout](./project-layout.md)
- Next: [Commands Overview](./commands/overview.md)
