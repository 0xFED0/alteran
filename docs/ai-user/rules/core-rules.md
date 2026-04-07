# Core Rules

These rules are meant for AI assistants working inside a normal Alteran project.

## Bootstrap And Entry

- `setup` is the bootstrap and repair surface.
- `activate` is the local environment-entry surface.
- On Unix, `activate` is sourced with `source ./activate`.
- If a project moved or local runtime state drifted, the recovery path is `setup`, not smarter activation tricks.

## Project Shape

- Alteran projects use first-class `apps/`, `tools/`, `libs/`, `tests/`, and `.runtime/`.
- `.runtime/` is local recoverable runtime state.
- Shared libraries may live under root `libs/`.
- App-local libraries may shadow shared libraries through the same `@libs/...` import family.

## Execution

- Managed execution happens through Alteran command surfaces such as `alteran run`, `alteran task`, `alteran app run`, `alteran tool run`, and `alteran test`.
- Plain `deno run` and `deno task` stay plain unless the route explicitly goes through Alteran.
- Alteran-managed execution uses project-local context and logs.

## Honesty Rules

- Do not describe `init` as the live bootstrap command.
- Do not present unsupported platform behavior as supported.
- Do not invent config or layout rules that are not already part of Alteran's documented user-facing model.
