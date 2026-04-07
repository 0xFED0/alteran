# Tool Layout Reference

## Supported Patterns

Simple entry plus helper module:

```text
tools/<name>.ts
tools/<name>/
  mod.ts
```

Directory fallback pattern:

```text
tools/<name>/
  mod.ts
```

Current discovery prefers `tools/<name>.ts` when it exists and can fall back to `tools/<name>/mod.ts` for directory-shaped tools.

## Default Scaffold

`alteran tool add <name>` creates:

```text
tools/<name>.ts
tools/<name>/mod.ts
```

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [App Layout Reference](./app-layout.md)
- Next: [Logging Reference](./logging.md)
