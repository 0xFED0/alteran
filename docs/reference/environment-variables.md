# Environment Variables

## Bootstrap And Source Variables

| Variable | Meaning |
| --- | --- |
| `DENO_SOURCES` | Source list for Deno release metadata and archives |
| `ALTERAN_RUN_SOURCES` | Runnable Alteran bootstrap sources |
| `ALTERAN_ARCHIVE_SOURCES` | Alteran archive installation/materialization sources |
| `ALTERAN_SOURCES` | Legacy fallback alias for `ALTERAN_RUN_SOURCES` |
| `ALTERAN_SRC` | Local authored Alteran source root override |
| `ALTERAN_EXTERNAL_CTX` | Default anchor for `alteran external` |

Source-list variables are parsed as lists. In current Alteran behavior they can
be separated with spaces or semicolons.

`ALTERAN_EXTERNAL_CTX` is only for explicit foreign-project execution and
should point at `alteran.json` or `app.json`. `deno.json` is not a valid
external context anchor.

## Activation Variables

| Variable | Meaning |
| --- | --- |
| `ALTERAN_HOME` | Project-local runtime root |
| `DENO_DIR` | Managed Deno cache directory |
| `DENO_INSTALL_ROOT` | Managed Deno platform root |

These are normally set for you by `activate`, `activate.bat`, or another
Alteran entrypoint such as a generated launcher.

## Managed Execution And Logging Variables

| Variable | Meaning |
| --- | --- |
| `ALTERAN_RUN_ID` | Current run id |
| `ALTERAN_ROOT_RUN_ID` | Root run id for the invocation tree |
| `ALTERAN_PARENT_RUN_ID` | Parent run id for child runs |
| `ALTERAN_ROOT_LOG_DIR` | Canonical root log directory |
| `ALTERAN_CUSTOM_LOG_DIR` | Optional additional mirror/copy destination for the current root log tree |
| `ALTERAN_LOG_MODE` | Root or child logging mode |
| `ALTERAN_LOGTAPE_ENABLED` | Whether LogTape integration is enabled |
| `ALTERAN_LOG_CONTEXT_JSON` | Internal structured logging context payload used by managed child processes |

`ALTERAN_ROOT_LOG_DIR` always points at the canonical project-local log tree.
`ALTERAN_CUSTOM_LOG_DIR`, when set, is an additional mirror/copy target rather
than a replacement root.

`ALTERAN_LOG_CONTEXT_JSON` is an Alteran-managed internal propagation variable,
not a user-facing configuration surface. LogTape configuration should come from
the current project's `alteran.json`, not from a serialized env payload.

## Path Semantics

Project-related paths are interpreted relative to the project or config they
belong to, not relative to an arbitrary caller working directory.

For `ALTERAN_SRC`, a relative path from `.env` is resolved against the location
of that `.env` file rather than against whichever directory happened to call
Alteran.

## Related References

- [CLI reference](./cli.md)
- [alteran.json reference](./alteran-json.md)

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [`deno.json` Integration](./deno-json-integration.md)
- Next: [Project Layout Reference](./project-layout.md)
