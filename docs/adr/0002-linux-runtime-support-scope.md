# ADR 0002: Limit Linux Runtime Support to GNU-Based Deno Targets

## Status

Accepted

## Context

Alteran activates projects by materializing and then preferring a project-local managed Deno runtime under `.runtime/deno/{os}-{arch}/`.

For Linux, current Deno release assets published by the Deno project are GNU targets such as `deno-x86_64-unknown-linux-gnu.zip` and `deno-aarch64-unknown-linux-gnu.zip`.

Official upstream references indicate that Alpine support is not provided by a plain musl-native Deno release artifact:

- Deno releases expose GNU Linux archives, not musl archives.
- `denoland/deno:bin` is built from `...-unknown-linux-gnu.zip`.
- `denoland/deno:alpine` adds extra glibc loader and library shims to make the GNU binary run on Alpine.

That means a project-local Deno downloaded by Alteran for Linux cannot be assumed to work on Alpine/musl environments.

Even if the base environment already contains a working global `deno` command, Alteran activation still switches the shell to the project-local managed Deno runtime, so Alpine remains unsupported end-to-end.

## Decision

Alteran should explicitly support Linux only for GNU-based environments.

Alpine/musl environments are out of support scope for now.

This applies to:

- normal project activation
- project-local managed Deno bootstrap
- Docker end-to-end support matrix

## Consequences

Positive:

- supported Linux behavior is honest and deterministic
- test matrix matches real platform guarantees
- avoids shipping a misleading "works on Alpine" claim based on partial bootstrap success

Tradeoffs:

- Alpine containers and hosts are not supported at the moment
- users who need Alpine must provide their own compatibility strategy outside Alteran, or use a GNU-based environment instead

## Revisit Conditions

This decision can be revisited if at least one of the following becomes true:

- official Deno releases provide musl-native Linux artifacts
- Alteran gains a maintained Alpine-specific bootstrap/runtime strategy
- Alteran stops requiring a project-local managed Deno runtime after activation

## References

- https://github.com/denoland/deno/releases
- https://github.com/denoland/deno_docker
- https://raw.githubusercontent.com/denoland/deno_docker/main/bin.dockerfile
- https://raw.githubusercontent.com/denoland/deno_docker/main/alpine.dockerfile
