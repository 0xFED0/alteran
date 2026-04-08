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
- `runtime`: remove generated runtime state under `.runtime/`
- `env`: remove generated `activate` and `activate.bat`
- `app-runtimes`: remove nested `apps/*/.runtime/`
- `logs`: remove `.runtime/logs/`
- `builds`: remove `dist/`
- `all`: safe cleanup of regenerable runtime-related state

## Compact

`alteran compact [dir]` is the stronger portability-oriented workflow. It:

- runs safe cleanup equivalent to `clean all`
- removes root `.runtime/`
- removes nested app runtimes
- removes `dist/`
- removes generated `activate` and `activate.bat`
- keeps user source, config, and public setup scripts

After compact, the project should be recoverable by running `setup` again.

Without `[dir]`, `compact` targets the current active project.

With `[dir]`, it explicitly compacts another Alteran project directory.

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
