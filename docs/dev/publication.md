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
alteran refresh
alteran tool run prepare_jsr
alteran tool run prepare_zip
alteran tool run publish_jsr
```

For repository maintainers and CI, this explicit preparation step matters.
Publication should run from an initialized local Alteran project, not by
treating bare-checkout authored source as if it were already the normal managed
runtime surface.

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
- `src/`
- generated `jsr.json`
- publication-local `deno.json`

Generated local activation artifacts are not part of release payloads.

The publication-local `deno.json` exists because `deno publish` requires the prepared package config to belong to a workspace. Each versioned `dist/jsr/<version>/` directory therefore acts as its own tiny publish workspace instead of depending on the repository-root workspace.

The staged JSR package intentionally stays lean and does not copy the full `docs/` tree. JSR already renders `README.md`, and links inside that README can point to repository-hosted docs.

`prepare_zip` builds a release bundle from the staged JSR payload and then adds the repository `docs/` tree before archiving. It also strips publish-only metadata such as the staged `deno.json` workspace file and `jsr.json`, because release zips are meant to act as runtime/bootstrap artifacts rather than as JSR publish workspaces.

## Automated Publication

The repository may also publish through a tag-triggered GitHub Actions workflow.

In the current repository layout, those workflow files live under `.github/workflows/` at the Alteran repository root and operate on `.` as the product directory.

The intended flow is:

- create a version tag such as `v0.1.0`
- run the shared repository test workflow first
- prepare the repository-local runtime explicitly through `refresh`
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
