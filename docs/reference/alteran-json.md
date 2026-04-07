# `alteran.json` Reference

## Current Shape

```json
{
  "name": "my-project",
  "auto_refresh_before_run": false,
  "deno_version": "2.4.1",
  "shell_aliases": {},
  "logging": {
    "stdout": { "mirror": true, "capture": true },
    "stderr": { "mirror": true, "capture": true },
    "logtape": false
  },
  "apps": {},
  "tools": {},
  "auto_reimport": {
    "apps": { "include": ["./apps/*"], "exclude": [] },
    "tools": { "include": ["./tools/*"], "exclude": [] }
  }
}
```

## Top-Level Fields

| Field | Meaning |
| --- | --- |
| `name` | Project name |
| `auto_refresh_before_run` | Whether managed runs refresh first |
| `deno_version` | Desired managed Deno version policy |
| `shell_aliases` | Arbitrary shell shortcuts injected by `shellenv` |
| `logging` | Stream mirroring/capture and optional LogTape settings |
| `apps` | Registered app entries |
| `tools` | Registered tool entries |
| `auto_reimport` | Discovery policy and exclusions |

## Field Notes

- `name`: defaults to the directory name of the project
- `auto_refresh_before_run`: when `true`, managed execution routes refresh before running
- `deno_version`: the desired managed Deno version or version constraint stored in project policy
- `shell_aliases`: extra shell shortcuts injected into `shellenv`; these are not app or tool registry entries
- `apps` / `tools`: Alteran's registry state for discovered or explicitly added project units
- `auto_reimport`: include and exclude rules that control structure-based discovery

## Registry Entry Shape

```json
{
  "path": "./apps/hello",
  "name": "hello",
  "title": "Hello",
  "discovered": true,
  "shell_aliases": ["app-hello"]
}
```

`shell_aliases` can be:

- omitted: allow default seeding behavior
- an array: explicit aliases
- `null` or `[]`: disable automatic alias seeding for that entry

## `auto_reimport`

Current default shape:

```json
{
  "apps": { "include": ["./apps/*"], "exclude": [] },
  "tools": { "include": ["./tools/*"], "exclude": [] }
}
```

`include` and `exclude` are both active discovery controls:

- matching paths must satisfy `include`
- matching paths are still blocked by `exclude`

This lets a project keep matching paths on disk while narrowing or broadening what Alteran auto-discovers during refresh.

## Logging Fields

- `logging.stdout.mirror`
- `logging.stdout.capture`
- `logging.stderr.mirror`
- `logging.stderr.capture`
- `logging.logtape`

`logging.logtape` is the opt-in switch for Alteran's LogTape integration path.

- `false` or absent: disabled
- `true`: enable Alteran's builtin events-oriented LogTape configuration
- object: deep-merge user LogTape config over Alteran defaults

## Related References

- [CLI reference](./cli.md)
- [Deno integration](./deno-json-integration.md)
- [Environment variables](./environment-variables.md)

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [CLI Reference](./cli.md)
- Next: [`deno.json` Integration](./deno-json-integration.md)
