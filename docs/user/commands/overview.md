# Commands Overview

Alteran uses an explicit command surface instead of positional shortcuts.

## Main Command Families

- [Project setup / initialization](./setup.md): `setup`, `shellenv`
- explicit external-project execution: `external`
- [Refresh and reimport](./refresh.md): `refresh`, `reimport`
- [Apps](./app.md): `app add|rm|purge|ls|run|setup`
- [Tools](./tool.md): `tool add|rm|purge|ls|run`
- [Managed execution](./run-task-deno.md): `run`, `task`, `deno`, `x`
- [Testing](./test.md): `test`
- [Cleanup](./clean.md): `clean`, `compact`
- [Versions and updates](./update-upgrade-use.md): `update`, `upgrade`, `use`

## Scope Rules

Alteran keeps a clear boundary between:

- external-targeting bootstrap commands such as `setup [dir]`
- active-project commands such as `refresh`, `app ...`, `tool ...`, `clean`, and `compact`

Advanced cross-project execution exists through the explicit `external` command rather than by letting every command quietly mutate arbitrary paths.

Supported external anchors are explicit Alteran config files:

- `alteran.json`
- `app.json`

`deno.json` is not a valid external context anchor.

## Help

Use:

```sh
alteran help
alteran <command> --help
```

## Reference

For the full command map, see [CLI Reference](../../reference/cli.md).

Related reference pages:

- [alteran.json reference](../../reference/alteran-json.md)
- [Environment variables](../../reference/environment-variables.md)
- [Cleanup scopes](../../reference/cleanup-scopes.md)

## Related Guides

- [Bootstrap an empty project](../guides/bootstrap-empty-project.md)
- [Working with apps](../guides/working-with-apps.md)
- [Working with tools](../guides/working-with-tools.md)
- [Using tests](../guides/tests.md)
- [Reading logs](../guides/logging.md)

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Activation](../activation.md)
- Next: [Project Setup](./setup.md)
