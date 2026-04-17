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
- `--dry-run` to run `deno publish --dry-run` against the prepared package without publishing it

It also accepts:

- `JSR_TOKEN`
- `ALTERAN_JSR_TOKEN`

If no token is provided, the publish flow may fall back to:

- interactive browser authentication on a local machine
- GitHub Actions OIDC authentication in CI when the JSR package is linked to
  the repository and the job has `id-token: write`

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

Versioned GitHub Releases may also attach standalone bootstrap scripts beside
the archive asset, for example:

- `alteran-v<version>.zip`
- `setup-v<version>`
- `setup-v<version>.bat`

This is intentional. Versioned asset names make it much easier to confirm which
archive or bootstrap script was actually downloaded, copied, or executed during
debugging, while the script contents themselves still represent the normal
`setup` / `setup.bat` bootstrap surface for that Alteran version.

## Automated Publication

The repository may also publish through a tag-triggered GitHub Actions workflow.

In the current repository layout, those workflow files live under `.github/workflows/` at the Alteran repository root and operate on `.` as the product directory.

The intended flow is:

- create a version tag such as `v0.1.0`
- run the shared repository test workflow first
- prepare the repository-local runtime explicitly through `refresh`
- verify the tag matches `ALTERAN_VERSION`
- run `publish_jsr --version current`
- on GitHub Actions, authenticate through OIDC with `id-token: write` after the
  JSR package has been linked to the repository in JSR settings
- optionally fall back to repository secret `JSR_TOKEN` for token-based auth
- prepare a release zip from the same staged publication payload
- attach versioned standalone bootstrap scripts such as `setup-v<version>` and
  `setup-v<version>.bat` to the same release
- attach that zip to the GitHub release created from the version tag

For maintainer workflow debugging, the publish workflows also support manual
`workflow_dispatch` dry-runs.

That dry-run mode should:

- resolve the current `ALTERAN_VERSION` from source;
- resolve the latest reachable merged `v*` tag from the current branch;
- run the same test, refresh, and artifact-preparation flow without performing
  the real external publish step;
- use `publish_jsr --dry-run` for the JSR path so the workflow validates the
  real `deno publish` preflight path rather than only checking package staging;
- upload the prepared staged output as a workflow artifact instead:
  - `publish-jsr` uploads `dist/jsr/<version>/`
  - `publish-release` uploads `dist/zips/<version>/`, including the zip and
    versioned standalone `setup` assets

The dry-run path is intended for validating workflow mechanics without burning a
real version bump or creating a real release asset.

When editing publication workflows, verify GitHub Action major versions against
the action's official upstream documentation at edit time instead of relying on
remembered examples. In this repository that especially applies to helpers such
as checkout, artifact upload, Deno setup, and GitHub release publication.

Publication tooling should be treated as product-critical. If the public bootstrap story changes, publication outputs, tests, and docs should change together.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Testing](./testing.md)
- Next: [Design Rules](./design-rules.md)
