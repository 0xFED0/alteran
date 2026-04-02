# Alteran

Alteran is a project-local runtime and scaffold manager for Deno automation
projects.

## Quick start

```sh
./activate
alteran setup .
alteran refresh
alteran app add hello
alteran tool add seed
```

In this repository, Alteran source-of-truth lives under `src/alteran/`, while
`.runtime/` is materialized/generated runtime state. In normal managed projects,
the effective local runtime still lives under `.runtime/alteran/`.
