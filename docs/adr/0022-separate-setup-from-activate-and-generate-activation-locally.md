# ADR 0022: Separate Public `setup` Bootstrap from Generated Local `activate`

## Status

Accepted

## Context

`activate` has accumulated two responsibilities that pull in opposite
directions:

- bootstrap/setup work for incomplete or empty projects
- shell activation for already materialized local environments

The bootstrap side needs path resolution, source selection, Deno acquisition,
materialization policy, and repository-source handling. The activation side
should be lightweight, predictable, and safe to `source`.

Combining both concerns into one public script makes path handling more fragile,
increases shell-specific complexity, and raises the risk of generating unwanted
files when activation is invoked from unusual working directories or shells.

## Decision

Alteran distinguishes two different bootstrap artifacts:

- public `setup` / `setup.bat`
- generated local `activate` / `activate.bat`

The same distinction also applies to app-local bootstrap surfaces:

- `setup` / `setup.bat` are the public, commit-worthy bootstrap entrypoints
- `app` / `app.bat` are generated local launchers and should not be treated as
  authored tracked source files

### `setup` / `setup.bat`

These are the public bootstrap entrypoints.

They may be downloaded into an empty directory and executed directly. Their job
is to:

- normalize the target path early
- resolve the location of the setup script itself
- locate or obtain Deno
- locate or obtain Alteran sources/runtime
- materialize the project/runtime if needed
- generate local activation artifacts

They may contain the unavoidable shell/batch logic required for first-time
bootstrap.

By default, public `setup` / `setup.bat` files are intended to remain tracked
in source control because they are part of the project's bootstrap contract
(`git clone -> setup`).

The corresponding top-level Alteran command should also be named `setup`, not
`init`.

`ensure-env` should not remain as a separate public command. Its intended
behavior collapses into `setup`.

### `activate` / `activate.bat`

These are generated local artifacts, not the public bootstrap surface.

Their job is intentionally narrow:

- set minimal absolute-path bootstrap variables such as `ALTERAN_HOME`,
  `DENO_DIR`, and `DENO_INSTALL_ROOT`
- expose an `alteran` shim or function using absolute paths
- delegate the rest of environment shaping to `alteran shellenv`

Generated `activate` / `activate.bat` should embed already-resolved absolute
project/runtime paths rather than trying to rediscover their own location at
runtime.

They are intentionally local, materialized activation artifacts:

- they are tied to one concrete project directory
- they are tied to one concrete materialized runtime layout
- they are not expected to remain valid after moving the project directory
- they are not expected to remain valid across OS/architecture changes
- after relocation or platform change, the supported recovery path is to run
  `setup` again and regenerate activation artifacts

They should not own the complex source/bootstrap logic that belongs in `setup`.

On Unix-like systems, generated `activate` should be sourced explicitly:

- `source ./activate`

Supporting executed-mode activation such as `eval "$(./activate)"` is not part
of the intended contract.

Running Unix `activate` as a separate process is also not part of the intended
contract, because environment shaping must affect the caller's current shell.

### Generated environment handling

Dedicated `.runtime/env/enter-env.*` scripts are removed from the target
architecture.

Instead:

- `refresh` regenerates `activate` / `activate.bat`
- `activate` asks Alteran for dynamic shell environment code via
  `alteran shellenv`
- environment activation is computed from current project state rather than
  persisted as separate env-script artifacts under `.runtime/env/`
- release/publication archives should ship public `setup` / `setup.bat`, but
  should not ship generated local `activate` / `activate.bat`
- generated launcher surfaces such as `app` / `app.bat` should also be treated
  as local/generated artifacts rather than authored bootstrap sources

## Consequences

Positive:

- public bootstrap becomes explicit and easier to reason about
- activation becomes smaller and less shell-fragile
- activation no longer depends on fragile runtime self-path discovery
- fewer generated env artifacts need to be tracked conceptually
- path normalization can happen once in `setup`, before bootstrap work starts

Tradeoffs:

- Alteran now owns two bootstrap-stage script types instead of one
- existing `activate`-first workflows need migration toward `setup`
- existing `alteran init` workflows need migration toward `alteran setup`
- generated `activate` must stay in sync with `alteran shellenv`

## Rejected Alternatives

### Keep a single public `activate` that both bootstraps and activates

Rejected because it keeps complex bootstrap policy inside the same script that
must also behave safely when sourced into a live shell.

### Persist dedicated `.runtime/env/enter-env.*` scripts indefinitely

Rejected because they duplicate environment-shaping behavior that Alteran can
compute dynamically through `alteran shellenv`, while adding more generated
artifacts and more sync surface.
