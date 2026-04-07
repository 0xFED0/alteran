# Publication

Alteran publication is staged and versioned rather than published directly from
the repository root.

## Output Directories

```text
dist/jsr/<version>/
dist/zips/<version>/
```

## Primary Public Surface

The intended primary public package identity is:

```text
@alteran
```

The target public command is:

```sh
deno run -A jsr:@alteran setup
```

## Current Tooling

Publication helpers live under `tools/`:

- `prepare_jsr`
- `prepare_zip`

They stage:

- `alteran.ts`
- `setup`
- `setup.bat`
- `README.md`
- `src/`
- generated `jsr.json`

Generated local activation artifacts are not part of release payloads.

Publication tooling should be treated as product-critical. If the public
bootstrap story changes, publication outputs, tests, and docs should change
together.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Testing](./testing.md)
- Next: [Design Rules](./design-rules.md)
