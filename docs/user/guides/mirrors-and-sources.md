# Mirrors And Sources

Alteran uses separate source classes for different jobs.

## Deno Sources

`DENO_SOURCES` controls where Alteran looks for Deno release metadata and Deno archives.

Default:

```text
https://dl.deno.land/release
```

## Alteran Run Sources vs Archive Sources

- `ALTERAN_RUN_SOURCES`: runnable bootstrap sources
- `ALTERAN_ARCHIVE_SOURCES`: install and materialization sources

This split is intentional:

- runnable sources are for obtaining a temporary executable Alteran process
- archive sources are for reconstructing `.runtime/alteran`

## Local Source Override

`ALTERAN_SRC` points Alteran at local authored source, which is especially useful inside this repository and in the example projects.

## Legacy Compatibility

`ALTERAN_SOURCES` is treated as a legacy alias fallback for `ALTERAN_RUN_SOURCES`.

## Practical Guidance

- prefer local authored source when developing Alteran itself
- provide archive sources for reproducible remote bootstrap
- do not assume runnable sources alone are enough to materialize the local runtime

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Reading Logs](./logging.md)
- Next: [Troubleshooting](../troubleshooting.md)
