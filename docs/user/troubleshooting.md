# Troubleshooting

## `activate` Says It Must Be Sourced

Use:

```sh
source ./activate
```

Running `./activate` as a subprocess is not the intended Unix contract.

## `activate` Or `activate.bat` Is Missing

Run `setup` again. Activation files are generated local artifacts, not the public bootstrap surface.

## Alteran Cannot Materialize Its Runtime

Check:

- local authored source via `ALTERAN_SRC`
- `ALTERAN_ARCHIVE_SOURCES`
- network access to your configured archive sources

Runnable sources alone do not count as canonical install sources.

## The Project Uses The Wrong Runtime Or Log Context

Reactivate the intended project. Alteran context is project-scoped, and a fresh `setup`, `activate`, `shellenv`, or generated app launcher should reset foreign inherited context.

## Linux Works Poorly On Alpine

Current Linux support targets GNU-based environments. Alpine or musl-based systems are outside the supported scope.

## I Moved The Project Directory

Rerun `setup`. Generated activation files are tied to one concrete project location and runtime layout.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Mirrors And Sources](./guides/mirrors-and-sources.md)
- Next: [FAQ](./faq.md)
