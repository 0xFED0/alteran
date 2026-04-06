# Tool Commands

Tools are first-class project automation units under `tools/`.

Use tool commands when the thing you want is a project command or helper, not a
separate application entrypoint.

## Commands

```sh
alteran tool add <name>
alteran tool rm <name>
alteran tool purge <name>
alteran tool ls
alteran tool run <name> [args...]
```

## Core Behaviors

- `add`: scaffold a tool entrypoint and helper module, then register it
- `rm`: remove the tool from Alteran registry only
- `purge`: remove tool files and unregister the tool
- `ls`: list registered tools
- `run`: execute the tool through Alteran-managed Deno

`alteran tool ls` prints the registered tool name together with its
project-relative entry path.

## Scaffold Shape

The default tool scaffold creates:

- `tools/<name>.ts`
- `tools/<name>/mod.ts`

The entry file stays tiny and delegates to the helper module.

That split keeps the public tool entry stable while giving you a normal module
to grow over time.

## Running A Tool

```sh
alteran tool run seed
alteran tool run seed demo
```

Tools are ideal for:

- project automation
- operational helpers
- release and maintenance tasks
- scripts you want kept inside the same managed environment as the rest of the
  project

If you already have an ad hoc scripts folder, this is the part of Alteran that
usually replaces it with a more explicit project model.

## Related Docs

- [Working with tools](../guides/working-with-tools.md)
- [Reference tool layout](../../reference/tool-layout.md)

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [App Commands](./app.md)
- Next: [Run, Task, Deno, And X](./run-task-deno.md)
