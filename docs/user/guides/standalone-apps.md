# Standalone Apps

Standalone apps are a supported but more advanced story than the normal in-project development flow.

## Create A Standalone App Scaffold

```sh
alteran app setup ./portable-clock
```

This creates a separate app folder with:

- `app.json`
- `deno.json`
- `core/`
- `libs/`
- `view/`
- public app-local `setup` and `setup.bat`
- generated local launchers `app` and `app.bat`

## Important Contract

- end users launch `app` or `app.bat` directly
- they do not `source app`
- first launch may trigger app-local setup if runtime material is missing
- later launches reuse the app-local runtime

## Identity Check

The launcher validates `app.json` identity instead of silently treating the wrong directory as valid.

## Related Example

See [advanced/standalone-app-runtime](../../../examples/advanced/standalone-app-runtime/README.md).

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Using Tests In A Project](./tests.md)
- Next: [Reading Logs](./logging.md)
