# `deno.json` Integration

Alteran synchronizes parts of root and app `deno.json` files.

## Root `deno.json`

Alteran refreshes these task entries:

- `alteran`
- `refresh`
- `test`
- `app:<name>`
- `tool:<name>`

It also manages imports such as:

- `@alteran`
- `@alteran/`
- `@alteran/logging/logtape_ext`
- `@logtape/logtape`
- `@libs/...`

And it syncs `workspace` to the registered app directories.

## App `deno.json`

Alteran ensures app tasks:

- `core`
- `view`
- `app`

It also projects root and app-local `@libs/...` imports into app-relative form.

## Preservation Behavior

Refresh tries to preserve unrelated user-defined tasks and imports that are not part of Alteran-owned keys.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [`alteran.json` Reference](./alteran-json.md)
- Next: [Environment Variables](./environment-variables.md)
