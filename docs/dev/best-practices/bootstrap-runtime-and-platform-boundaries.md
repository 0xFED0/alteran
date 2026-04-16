# Bootstrap, Runtime, And Platform Boundaries

## Keep `setup` And `activate` Strictly Separate

- `setup` is the public bootstrap and repair surface.
- `activate` is a generated local entrypoint for entering an already materialized environment.
- If behavior downloads, repairs, reconstructs, or discovers runtime material, it almost certainly belongs in `setup`, not in `activate`.

## Keep `activate` Lightweight And Deterministic

- Generated `activate` should embed resolved absolute paths.
- Generated `activate` is not meant to be portable across moved directories or different OS/runtime layouts.
- If a project moved or its runtime layout changed, the correct recovery path is `setup`, not smarter activation magic.

## Unix Activation Should Stay Sourced-Only

- Support `source ./activate` clearly.
- Reject executed-mode `./activate` with a clear message.
- Do not design around `eval "$(./activate)"`; it creates quoting and parsing complexity that is not worth the ambiguity.

## Set `DENO_DIR` Early

`activate` should set `DENO_DIR` before the first Deno call that could resolve dependencies. Otherwise the project may leak cache writes into a global or foreign project location.

## Keep Shell Logic Minimal

- Shell should orchestrate.
- TypeScript should own real logic.
- If shell starts understanding too much about runtime policy or project architecture, move that logic into TS.

## Prefer Path Certainty Over Path Cleverness

- Normalize paths early.
- When the generator already knows an absolute path, embed it.
- Avoid fragile shell-specific tricks when the path can be made explicit once.

## Keep Bootstrap Source Boundaries Clean

Prefer this materialization order:

1. local authored source
2. already materialized local runtime
3. archive sources

Use `ALTERAN_RUN_SOURCES` only for obtaining a runnable Alteran process, not as the canonical installation source.

## Do Not Treat Authored Source Bootstrap As An Activated Project

- Repository-root `alteran.ts` is a public/bootstrap surface.
- It is not the preferred maintainer surface for CI, publication, or other
  steady-state managed execution.
- If a workflow needs normal Alteran behavior, prepare the project explicitly
  through `setup` or `refresh` first.
- Then run commands through the prepared local project runtime and generated
  entry surfaces.

The smell to avoid is:

- a pipeline runs `deno run -A ./alteran.ts tool run ...` directly from a bare
  checkout and silently relies on authored source as if that were equivalent to
  an initialized project runtime.

## Avoid Recursive Bootstrap Designs

The classic failure mode is:

- remote Alteran boots
- then re-enters bootstrap through the same remote source
- and loops or half-materializes state

When bootstrap re-enters bootstrap, stop and redesign the boundary.

## Seed From What Is Already Available

- If the current process already has a working local Deno or cache, prefer seeding from it before downloading.
- This matters a lot for offline-ish bootstrap and test fixtures.

## Be Honest About Platform Scope

- GNU-based Linux is in scope.
- Alpine/musl is not currently a supported runtime target.
- Do not quietly broaden support in docs or code without intentionally solving the binary/runtime implications.

## Windows And Unix Need Symmetry, Not Identity

- Behavior should be conceptually aligned across `.sh` and `.bat`.
- Implementations do not need identical style.
- Favor clarity and compatibility over clever transliteration tricks.

## Practical Smells

- one public script tries to both bootstrap and activate
- activation silently inherits foreign runtime context
- root/example checked-in bootstrap scripts drift away from the template
- path logic works only in one shell mode
- a fix only works by re-entering the network path again

## Related Source Of Truth

- [ADR 0001](../../adr/0001-run-sources-vs-archive-sources.md)
- [ADR 0005](../../adr/0005-src-is-the-authored-source-of-truth.md)
- [ADR 0010](../../adr/0010-minimal-shell-bootstrap-and-typescript-owned-logic.md)
- [ADR 0022](../../adr/0022-separate-setup-from-activate-and-generate-activation-locally.md)
- [Runtime Materialization](../runtime-materialization.md)
