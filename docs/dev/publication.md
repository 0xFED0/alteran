# Publication

Alteran publication is staged and versioned rather than published directly from the repository root.

## Output Directories

```text
dist/jsr/<version>/
dist/zips/<version>/
```

## Primary Public Surface

The intended primary public package identity is:

```text
@alteran/alteran
```

The target public command is:

```sh
deno run -A jsr:@alteran/alteran setup
```

## Current Tooling

Publication helpers live under `tools/`:

- `prepare_jsr`
- `prepare_zip`
- `publish_jsr`

Typical repository flow:

```sh
alteran tool run prepare_jsr
alteran tool run prepare_zip
alteran tool run publish_jsr
```

`publish_jsr` supports:

- no `--version`, which means `current`
- `--version current` to prepare and publish the current repository version explicitly
- `--version latest` to publish the latest already-prepared `dist/jsr/<version>/`
- `--version <x.y.z>` to publish a specific already-prepared version directory
- `--token <token>` to pass a JSR token explicitly

It also accepts:

- `JSR_TOKEN`
- `ALTERAN_JSR_TOKEN`

If no token is provided, the publish flow may fall back to interactive authentication.

They stage:

- `alteran.ts`
- `setup`
- `setup.bat`
- `README.md`
- `docs/`
- `src/`
- generated `jsr.json`
- publication-local `deno.json`

Generated local activation artifacts are not part of release payloads.

The publication-local `deno.json` exists because `deno publish` requires the prepared package config to belong to a workspace. Each versioned `dist/jsr/<version>/` directory therefore acts as its own tiny publish workspace instead of depending on the repository-root workspace.

`prepare_zip` packages the prepared versioned JSR directory as-is, so release zips inherit the same staged `README.md`, `docs/`, source tree, and publication config files.

## Automated Publication

The repository may also publish through a tag-triggered GitHub Actions workflow.

In the current repository layout, those workflow files live under `.github/workflows/` at the Alteran repository root and operate on `.` as the product directory.

The intended flow is:

- create a version tag such as `v0.1.0`
- run the shared repository test workflow first
- verify the tag matches `ALTERAN_VERSION`
- run `publish_jsr --version current`
- authenticate with repository secret `JSR_TOKEN`
- prepare a release zip from the same staged publication payload
- attach that zip to the GitHub release created from the version tag

Publication tooling should be treated as product-critical. If the public bootstrap story changes, publication outputs, tests, and docs should change together.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Testing](./testing.md)
- Next: [Design Rules](./design-rules.md)
