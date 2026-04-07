# App Commands

Apps are first-class Alteran project units under `apps/`.

Use app commands when the thing you are building is a runnable application entrypoint, not just a helper script.

## Commands

```sh
alteran app add <name>
alteran app rm <name>
alteran app purge <name>
alteran app ls
alteran app run <name> [args...]
alteran app setup <path>
```

## Core Behaviors

- `add`: scaffold an app if missing and register it
- `rm`: remove the app from Alteran registry only
- `purge`: remove app files and unregister the app
- `ls`: list registered apps
- `run`: run the app task from the app's `deno.json`
- `setup`: create a standalone app scaffold outside the main project

`alteran app ls` prints the registered app name together with its resolved project-relative path.

## What An App Scaffold Includes

A managed app scaffold currently includes:

- `app.json`
- `deno.json`
- `core/mod.ts`
- `libs/`
- `view/README.md`

Managed apps also receive generated local helper scripts such as `setup`, `setup.bat`, `app`, and `app.bat`.

Their roles are intentionally different:

- `setup` / `setup.bat` are app-local bootstrap entrypoints
- `app` / `app.bat` are generated launchers for "run the app now" UX

All of them are Alteran-generated artifacts rather than the canonical app source itself, but the setup scripts are part of the app-local bootstrap surface while the launchers are the ephemeral execution entrypoints.

## Running An App

```sh
alteran app run hello
alteran app run hello --demo
```

This executes the app inside the Alteran-managed environment and logs the run under the project log root.

## Standalone App Setup

```sh
alteran app setup ./portable-clock
```

This creates a standalone app folder that owns its own bootstrap surface and app-local runtime expectations.

That command is for creating an app outside the current main project tree. It is different from `alteran app add`, which creates a managed app under `apps/` in the current project.

## Related Docs

- [Working with apps](../guides/working-with-apps.md)
- [Standalone apps guide](../guides/standalone-apps.md)
- [Reference app layout](../../reference/app-layout.md)

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Refresh And Reimport](./refresh.md)
- Next: [Tool Commands](./tool.md)
