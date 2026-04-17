# Runtime Materialization

Runtime materialization is the process of making a project locally runnable without treating `.runtime/` as authored source.

## Source Priority

Current design intent and implementation align around this order:

1. local authored source if available
2. already materialized local runtime if valid
3. archive sources for installation/materialization

Runnable bootstrap sources can launch Alteran, but they are not the canonical materialization source.

This separation is intentional: execution bootstrap and installation source are different responsibilities.

## Repository CI Boundary

Maintainer automation must not treat repository-root authored entrypoints as a
substitute for a materialized local project runtime.

In particular:

- `deno run -A ./alteran.ts ...` from a bare repository checkout is a bootstrap
  surface, not the normal maintainer execution surface;
- CI, publish, and release workflows should first make the repository an
  initialized local Alteran project through `setup` or `refresh`;
- after that, commands should run through the prepared local project runtime and
  generated entry surfaces rather than assuming authored source alone is an
  acceptable steady-state execution model.

If a workflow needs managed execution semantics such as `tool run`, `task`,
logging, or preinit, it should prepare the local runtime explicitly first.

## What Gets Materialized

```text
.runtime/
  alteran/
  tools/
  libs/
  deno/
```

## Deno Materialization

Alteran manages one effective Deno version per runtime. The managed Deno lives under the platform-specific branch:

```text
.runtime/deno/<os>-<arch>/
```

## Source vs Generated State

- `src/alteran/`, `src/tools/`, `src/libs/`: authored source
- `.runtime/alteran/`, `.runtime/tools/`, `.runtime/libs/`: generated local material

## Remote Acquisition Boundary

- `ALTERAN_RUN_SOURCES`: bootstrap/execution sources
- `ALTERAN_ARCHIVE_SOURCES`: public user-preferred install/materialization sources
- `ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES`: internal version-pinned bootstrap handoff sources

This split avoids recursive or incomplete runtime reconstruction from runnable URLs alone.

When remote archive acquisition is needed, the intended priority is:

1. user-configured `ALTERAN_ARCHIVE_SOURCES`
2. internal bootstrap handoff sources such as `ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES`
3. built-in default archive source templates for the current Alteran version

Built-in archive defaults are intended for the "no explicit archive env was
provided" case. If a caller explicitly defines archive-source variables, even
to an empty list, that explicit archive-source state should remain visible to
the runtime instead of being silently replaced by invented defaults.

If a design starts solving missing local material by recursively re-entering a runnable remote bootstrap path, treat that as a smell and redesign the boundary.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Architecture](./architecture.md)
- Next: [Command Model](./command-model.md)
