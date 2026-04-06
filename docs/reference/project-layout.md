# Project Layout Reference

## Baseline Root Items After Setup

```text
setup
setup.bat
alteran.json
deno.json
apps/
tools/
libs/
tests/
.runtime/
```

Optional or regenerated root items may also exist:

```text
activate
activate.bat
deno.lock
```

## `.runtime/` Branches

```text
.runtime/
  alteran/
  tools/
  libs/
  logs/
  deno/
    <os>-<arch>/
      bin/
      cache/
```

## Notes

- root `setup` and `setup.bat` are part of the bootstrap contract
- root `activate` and `activate.bat` are generated local artifacts
- `deno.lock` is optional rather than guaranteed
- `.runtime/` is recoverable local state

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Environment Variables](./environment-variables.md)
- Next: [App Layout Reference](./app-layout.md)
