# Working With Apps

Apps are managed subprojects under `apps/`.

## Create One

```sh
alteran app add hello
```

This scaffolds:

- `apps/hello/app.json`
- `apps/hello/deno.json`
- `apps/hello/core/mod.ts`
- `apps/hello/libs/`
- `apps/hello/view/`

## Run It

```sh
alteran app run hello
```

Alteran resolves the app directory, reads its `deno.json`, and runs the app
task inside the managed environment.

## Remove vs Purge

- `alteran app rm hello`: unregister only
- `alteran app purge hello`: delete the app files and unregister it

## App-Local Libraries

Apps can own local libraries under `apps/<name>/libs/`. In app context,
`@libs/...` resolution prefers the app-local library first and then falls back
to the root `libs/` directory.

## Related Example

See [02-multi-app-workspace](../../../examples/02-multi-app-workspace/README.md).

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Bootstrap An Empty Project](./bootstrap-empty-project.md)
- Next: [Working With Tools](./working-with-tools.md)
