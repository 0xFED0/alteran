# Clean And Compact

Alteran distinguishes between safe cleanup of regenerable state and reducing a project to a transfer-ready bootstrap shape.

## Commands

```sh
alteran clean <scope> [<scope> ...]
alteran compact [dir]
alteran compact-copy <destination> [--source=<project-dir>]
```

## Clean Scopes

- `cache`: remove `.runtime/deno/<platform>/cache`
- `runtime`: remove generated runtime state under `.runtime/` while preserving the current managed Deno binary when needed
- `env`: remove generated `activate`, `activate.bat`, and `activate.ps1`
- `app-runtimes`: remove nested `apps/*/.runtime/`
- `logs`: remove `.runtime/logs/`
- `builds`: remove `dist/`
- `all`: safe cleanup of regenerable runtime-related state

On Windows, cleanup routes that conflict with the active managed runtime may use a narrow temporary cleanup batch outside the project runtime tree. This is an implementation detail of `cache`, `runtime`, `all`, and `compact`, not a general hook framework for every cleanup scope.

## Compact

`alteran compact [dir]` is the stronger portability-oriented workflow. It:

- runs safe cleanup equivalent to `clean all`
- removes root `.runtime/`
- removes nested app runtimes
- removes `dist/`
- removes generated `activate`, `activate.bat`, and `activate.ps1`
- keeps user source, config, and public setup scripts

After compact, the project should be recoverable by running `setup` again.

Without `[dir]`, `compact` targets the current active project.

With `[dir]`, it explicitly compacts another Alteran project directory.

On Windows, `compact` may use the same narrow temporary cleanup batch model for the final `.runtime/` removal step.

## Compact Copy

`alteran compact-copy` creates a transfer-ready copy without mutating the source project in place.

Use it when you want:

- a portable handoff copy;
- a hermetic temp copy for validation;
- staging that should not dirty the source project.

If `--source` is omitted, the current active project is used as the source.

## Safety

`compact` asks for confirmation in interactive mode unless you pass a yes flag.

## Related Reference

- [Cleanup scopes reference](../../reference/cleanup-scopes.md)

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Testing](./test.md)
- Next: [Update, Upgrade, And Use](./update-upgrade-use.md)
