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
- `ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES`: internal bootstrap-script handoff sources

This split is intentional:

- runnable sources are for obtaining a temporary executable Alteran process
- archive sources are for reconstructing `.runtime/alteran`

Current default direction is:

- runnable bootstrap defaults may use `jsr:@alteran/alteran`
- archive materialization defaults may use versioned release archives for the
  current Alteran version

`ALTERAN_ARCHIVE_SOURCES` may contain either:

- exact archive URLs
- template URLs such as
  `https://example.com/releases/v{ALTERAN_VERSION}/alteran-v{ALTERAN_VERSION}.zip`

If a source contains `{ALTERAN_VERSION}`, Alteran substitutes the current
runtime version. If it does not, Alteran uses the source exactly as written.

## Local Source Override

`ALTERAN_SRC` points Alteran at local authored source, which is especially useful inside this repository and in the example projects.

## Legacy Compatibility

`ALTERAN_SOURCES` is treated as a legacy alias fallback for `ALTERAN_RUN_SOURCES`.

## Practical Guidance

- prefer local authored source when developing Alteran itself
- prefer exact user-provided mirrors first in `ALTERAN_ARCHIVE_SOURCES`
- use template archive URLs when you want one mirror definition to follow the
  current Alteran version
- do not edit `ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES` during normal use; it is for
  generated `setup` / `setup.bat` handoff
- do not assume runnable sources alone are enough to materialize the local runtime

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Reading Logs](./logging.md)
- Next: [Troubleshooting](../troubleshooting.md)
