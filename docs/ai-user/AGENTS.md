# AGENTS.md

This is a portable AI user bundle for Alteran projects.

Copy this directory into an Alteran-managed project and customize it locally if needed.

## What This Bundle Is For

Use this bundle when an AI assistant is helping inside a normal Alteran project.

It is for:

- bootstrapping and repairing an Alteran project
- working with apps, tools, libs, and tests
- using Alteran commands correctly
- preserving Alteran project structure and managed execution boundaries

It is not for modifying the Alteran repository itself.

## Read First

- `README.md`
- `rules/core-rules.md`
- `agents/alteran-expert.md`

Then use the relevant skills under `skills/`.

## Project Rules

- Keep `setup` as the bootstrap and repair surface.
- Treat `activate` as the local environment-entry surface.
- On Unix, `activate` is sourced with `source ./activate`.
- Plain `deno run` and `deno task` stay plain unless you intentionally use an Alteran-managed command route.
- Treat `.runtime/` as recoverable local project state, not primary authored source.
- Keep Alteran config and paths explicit rather than relying on hidden magic.
- Do not revive legacy command vocabulary such as `init`.
- Keep support claims honest. GNU-based Linux is the intended Linux runtime target; Alpine/musl is not the supported target today.

## Do Not

- do not invent a second project structure that conflicts with Alteran
- do not blur `setup` and `activate`
- do not assume plain Deno commands automatically inherit managed execution
- do not treat copied local runtime state as the only source of truth
- do not present unsupported platform behavior as supported

## Validation

Pick the smallest honest command for the user task, for example:

```sh
./setup
source ./activate
alteran help
alteran app run <name>
alteran tool run <name>
alteran test -A
```
