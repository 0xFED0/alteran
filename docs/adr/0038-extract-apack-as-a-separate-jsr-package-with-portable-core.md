# ADR 0038: Extract `apack` as a Separate JSR Package with Portable Core

- Status: Accepted
- Date: 2026-04-18
- Decision scope: Alteran repository architecture, packaging format, JSR publishing, and runtime portability strategy

## Context

Alteran needs a reliable way to materialize runtime files and related text assets from an importable module instead of downloading and unpacking a GitHub release archive during setup.

The new mechanism should:

- package local files into an importable JavaScript module
- unpack safely into a runtime directory
- support integrity verification
- avoid manual escaping problems in generated code
- work well for text assets, not only JS/TS modules
- fit the current Alteran repository layout and current JSR preparation flow

The current repository structure places the main Alteran implementation in `src/alteran`, and the root `deno.json` maps `@alteran` to `./src/alteran/mod.ts`.

The current JSR preparation flow is implemented in `tools/prepare_jsr/mod.ts`. It prepares `dist/jsr/<version>`, copies `alteran.ts`, writes setup scripts, copies `README.md`, copies the full `src/` tree, and publishes the Alteran package with exports `.` -> `./alteran.ts` and `./lib` -> `./src/alteran/mod.ts`.

At the same time, there is interest in future Node.js bootstrap support, where Node may prepare Deno and possibly unpack runtime files before passing execution to Deno.

This led to several architectural questions:

1. Should packaging stay embedded inside the main Alteran package?
2. Should the generated pack be a bundle of Alteran code or a generic asset package?
3. Should `apack` be Deno-only or portable across runtimes?
4. Should `apack` be a separate public package or just an internal module?
5. Should the output be a binary archive, a JS module, or both?

## Decision

We decided to:

1. Create `apack` as a separate library in the Alteran repository under `libs/apack`
2. Publish it as a separate JSR package: `@alteran/apack`
3. Keep the main Alteran package separate as `@alteran/alteran`
4. Preserve the existing Alteran source layout rooted in `src/alteran`
5. Keep `apack` output format limited to generated `.apack.js` data modules in v1
6. Keep `apack` local-file-only in v1
7. Design `apack` core to avoid unnecessary Deno-specific APIs, while allowing runtime-specific filesystem and CLI adapters
8. Keep generated runtime pack artifacts for Alteran internal at first, rather than publishing a third dedicated runtime-pack package immediately
9. Expose packing and unpacking through Alteran CLI initially, with room for future `@alteran/apack/denocli` and `@alteran/apack/nodecli` entrypoints
10. Use per-file base64 payloads with optional per-file Brotli compression and SHA-256 verification of uncompressed content

## Rationale

### 1. Why a separate package instead of embedding `apack` inside `@alteran/alteran`

`apack` has grown beyond being a tiny internal helper. It now has its own format, core logic, API, safety rules, and potential runtime portability goals.

If kept as a public submodule of `@alteran/alteran`, it would:

- blur package boundaries
- tie `apack` versioning more tightly to Alteran releases
- make reuse in non-Alteran contexts less natural
- complicate future Node-oriented use

A separate package keeps responsibilities clean.

### 2. Why keep Alteran itself in `src/alteran`

The current repository and JSR preparation flow already assume this layout. The current root import map and `prepare_jsr` logic are aligned around `src/alteran` as the main source root.

Moving Alteran out of `src/alteran` just to accommodate `apack` would create churn without real payoff.

So the chosen direction is additive:
- keep Alteran where it is
- add `libs/apack`
- extend prepare/publish tooling to support multiple packages

### 3. Why `.apack.js` instead of a binary archive format

The main use case is importable generated packaging for materialization. A JS data module:

- is easy to import
- avoids manual escape-heavy source generation by storing base64 payloads
- works naturally with Deno and future Node consumption
- aligns with the intended bootstrap/materialization flow

A separate binary archive format would add complexity without serving the core goal.

### 4. Why no builtin unpack function in generated artifacts

Generated `.apack.js` files should remain simple data modules.

Keeping unpack logic out of the artifact:
- reduces coupling between format and runtime implementation
- makes generated files easier to validate and debug
- avoids embedding runtime behavior into every package
- preserves future freedom to evolve unpacking logic separately

### 5. Why local paths only in v1

Supporting network URLs would make `apack` responsible not just for packaging but also for remote fetching, path inference, and trust boundaries.

That would expand scope too early.

The current problem is local materialization of known project files, so local filesystem input is enough for v1.

### 6. Why portable core instead of Deno-only internals

Future Node bootstrap support is a real design driver. Node may be used to bootstrap Deno and optionally unpack runtime files before transferring control.

Making the `apack` core runtime-portable:
- keeps that option open
- avoids Deno lock-in for pure format logic
- makes `apack` more reusable in other environments

At the same time, forcing complete Node parity immediately would slow down v1. So only the core is kept portable; filesystem and CLI adapters may stay runtime-specific.

### 7. Why separate `@alteran/apack` but not a third public runtime-pack package yet

It is useful to separate the reusable library package from the main Alteran package now.

It is **not** yet useful to introduce a third package just for generated runtime snapshot packs. That would add publication and versioning complexity before a clear need exists.

So:
- reusable library package now
- generated runtime pack stays internal for now
- separate public runtime-pack package may be revisited later if it proves useful

### 8. Why not use a bundle of Alteran instead

A JS bundle of all Alteran code would:

- create two runtime representations: bundle vs module tree
- complicate runtime assumptions
- handle JS code better than arbitrary assets
- be less future-proof for documentation, templates, or images

`apack` solves a broader and more stable problem: packaging arbitrary local assets as data.

### 9. Why per-file packing with optional Brotli and SHA-256

Per-file handling provides:
- simpler debugging
- safer updates
- selective overwrite logic
- straightforward hash verification
- no dependency on a whole-archive container format

Brotli is suitable for text-heavy content, but not every file benefits from compression. Therefore compression must be per file, with fallback to uncompressed data.

Hash verification should protect the final unpacked content, so SHA-256 is computed from original uncompressed bytes.

## Consequences

### Positive

- clean separation between Alteran runtime/tooling and packaging library
- preserves current `src/alteran` layout
- supports future Node bootstrap scenarios
- avoids bundle-only constraints
- avoids binary archive complexity
- generated artifacts stay simple and importable
- package boundaries and responsibilities become clearer
- `apack` can be reused independently from Alteran

### Negative

- repository build/publish tooling becomes multi-package
- there will be at least two JSR packages to prepare and publish
- Deno-only convenience code cannot simply be assumed inside all `apack` layers
- some implementation work moves into adapters and packaging orchestration

### Neutral / Deferred

- whether to publish runtime snapshot packs as public packages remains open
- whether to add dedicated `nodecli` support remains open
- whether to expose more advanced archive features remains open

## Rejected Alternatives

### A. Keep `apack` fully internal to `@alteran/alteran`

Rejected because `apack` is already becoming a reusable library with its own format and portability concerns.

### B. Publish `apack` as a public subpath inside `@alteran/alteran`

Rejected because it keeps package boundaries blurry and over-couples the reusable part to the main package.

### C. Replace materialization with a single bundled Alteran runtime

Rejected because it creates dual runtime representations and does not handle non-JS assets well.

### D. Introduce a binary `.apack` archive format in v1

Rejected because it adds complexity without improving the main use case of generated importable modules.

### E. Support URLs and remote sources in v1

Rejected because it expands scope from packaging to fetching and trust handling.

## Implementation Notes

Recommended initial repository direction:

```txt
src/alteran/        # existing Alteran package source
libs/apack/         # new apack package source
tools/prepare_jsr/  # extended to prepare multiple packages
```

Recommended package strategy:

- `@alteran/alteran`
- `@alteran/apack`

Recommended artifact strategy:

- generated `.apack.js` files as data modules
- runtime snapshot packs initially treated as internal build artifacts

## Follow-up Work

1. extend spec for repository/package layout and package-aware prepare/publish flow
2. implement `libs/apack`
3. adapt Alteran build tooling to prepare/publish `@alteran/apack`
4. integrate `apack` into Alteran materialization/setup flow
5. keep Node bootstrap design compatible with portable `apack` core
