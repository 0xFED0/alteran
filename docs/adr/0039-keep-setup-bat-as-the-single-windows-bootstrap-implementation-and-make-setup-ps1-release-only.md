# ADR 0039: Keep `setup.bat` as the Single Windows Bootstrap Implementation and Make `setup.ps1` Release-Only

## Status

Accepted

## Context

Alteran already has a canonical Windows bootstrap surface:

- `setup.bat`

That batch script is responsible for Windows bootstrap behavior in both normal
project roots and repository-local bootstrap flows.

At the same time, Windows PowerShell users benefit from a release-friendly
one-shot bootstrap path such as:

```powershell
irm https://.../setup-v<version>.ps1 | iex
```

The obvious danger is architectural drift:

- introducing a second Windows bootstrap implementation in PowerShell;
- letting `setup.ps1` become a normal project-root bootstrap contract;
- forcing maintainers to keep batch and PowerShell bootstrap logic in sync;
- making future Windows bootstrap fixes land in two languages instead of one.

Alteran already decided elsewhere to keep shell/bootstrap logic minimal and keep
real logic single-sourced where possible. A full PowerShell bootstrap
reimplementation would cut directly against that direction.

## Decision

Alteran keeps `setup.bat` as the single Windows bootstrap implementation.

`setup.ps1` is allowed only as a release-distributed convenience wrapper for the
PowerShell `irm|iex` bootstrap path.

It is not part of the normal managed project layout and is not a general
project-root bootstrap contract.

## What `setup.ps1` Is

`setup.ps1` is a thin release wrapper that:

1. resolves the target directory using PowerShell;
2. writes `setup.bat` into that target directory;
3. delegates bootstrap to `cmd` by invoking the written `setup.bat`;
4. exits with the delegated batch process status.

This means:

- there is no second Windows bootstrap implementation;
- Windows bootstrap behavior remains single-sourced in `setup.bat`;
- PowerShell users still get a first-class `irm|iex` release path.

## What `setup.ps1` Is Not

`setup.ps1` is not:

- a tracked public bootstrap file in normal project roots;
- a generated file produced by ordinary `alteran setup` in user projects;
- a maintained peer implementation beside `setup.bat`;
- a reason to make PowerShell a required dependency for normal Windows project
  bootstrap.

Normal project roots still rely on:

- `setup`
- `setup.bat`

Generated local activation remains separate:

- `activate`
- `activate.bat`
- `activate.ps1`

## Distribution Model

`setup.ps1` is produced only in release assets such as:

- `dist/zips/<version>/setup-v<version>.ps1`
- the corresponding GitHub Release attachment

It should not be committed as a normal root bootstrap artifact and should not be
materialized into ordinary managed projects during `setup`.

## Consequences

Positive:

- Windows bootstrap logic stays single-sourced in batch;
- PowerShell users get a convenient `irm|iex` path;
- project layout stays cleaner because `setup.ps1` is not another normal root
  bootstrap file;
- future Windows bootstrap fixes land in one implementation instead of two.

Tradeoffs:

- PowerShell bootstrap remains a wrapper, not a native PowerShell bootstrap
  implementation;
- the release pipeline must continue producing an extra release-only bootstrap
  asset;
- tests must explicitly cover the `iex` execution path so the wrapper contract
  does not silently regress.

## Rejected Alternatives

### Add a full PowerShell bootstrap implementation

Rejected because it would create a second Windows bootstrap implementation and
split maintenance across batch and PowerShell.

### Generate `setup.ps1` into every project root

Rejected because the normal project bootstrap contract does not need another
public root surface. `setup.bat` already covers Windows project bootstrap,
including invocation from PowerShell.

### Treat `setup.ps1` as a peer of `setup` and `setup.bat` everywhere

Rejected because that would blur the difference between:

- normal managed project layout; and
- release-distributed convenience assets.

The PowerShell wrapper is intentionally narrower than the primary bootstrap
contract.
