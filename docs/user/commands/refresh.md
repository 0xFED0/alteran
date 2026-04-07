# Refresh And Reimport

Refresh keeps project-generated state coherent with project structure.

If `setup` is the command that gets a project into a usable state, `refresh` is
the command that keeps that state aligned as the project evolves.

## Main Commands

```sh
alteran refresh
alteran reimport apps <dir>
alteran reimport tools <dir>
```

## What `refresh` Does

`alteran refresh` re-synchronizes the project. In current Alteran behavior it:

- ensures project structure and markers exist
- materializes or repairs runtime files
- reloads config
- discovers apps and tools from the project tree
- updates root `deno.json` tasks, imports, and workspace entries
- ensures per-app config and app `deno.json`
- regenerates activation files and managed app helper scripts

It does not exist to change your source code. It exists to bring generated
state and discovered project structure back in sync with the source tree.

## What `reimport` Does

`reimport` scans a directory, registers discovered apps or tools from that
directory, and then runs a refresh.

Use it when you add or move project units outside the normal `app add` and
`tool add` flow.

Use plain `refresh` when Alteran already knows about the project units and you
just need generated state rebuilt.

## When To Run It

- after structural changes made outside Alteran commands
- after copying in apps or tools from somewhere else
- after editing config and wanting generated files updated

## Related Guides

- [Working with apps](../guides/working-with-apps.md)
- [Working with tools](../guides/working-with-tools.md)
- [Refresh example](../../../examples/06-refresh-reimport/README.md)

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Project Setup](./setup.md)
- Next: [App Commands](./app.md)
