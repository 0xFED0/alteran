# ADR 0036: Use a Narrow Cleanup Handoff Instead of Generic Postrun Hooks

## Status

Accepted

## Context

Alteran has a small but important Windows-specific cleanup problem.

On Unix-like systems, cleanup and compacting can usually remove runtime-local files directly from the running process. Linux and macOS allow unlinking open files and generally do not suffer from the same executable-locking behavior as Windows.

Windows is different:

- the active managed `deno.exe` may keep runtime-local files locked while the current Alteran command is still running;
- Deno cache files under `.runtime/deno/<platform>/cache` can remain open during managed execution;
- batch wrappers and activated sessions may still reference files under `.runtime/alteran` while command teardown is happening;
- removing the current runtime tree from inside the process that depends on it is fragile.

A previous design introduced run-scoped generic `postrun` hooks under `.runtime/hooks/{ROOT_RUN_ID}/postrun.sh` or `.runtime/hooks/{ROOT_RUN_ID}/postrun.bat`. That design was more general than the actual need.

The real use cases are narrow:

- clean Deno-managed cache state;
- compact the active project by removing `.runtime/` only after the managed Alteran process has exited;
- avoid deleting the currently running managed Deno executable directly from inside the active process.

Alteran does not need a generic deferred shell execution framework for this. A generic postrun system creates extra moving parts:

- generated shell or batch scripts;
- hook directories inside the runtime tree being deleted;
- postrun logs and user message files;
- copy-back behavior into `.runtime/logs`;
- extra status-routing logic in wrappers;
- avoidable quoting and batch-control-flow complexity.

That complexity is disproportionate to the cleanup problem and creates its own failure modes.

## Decision

Alteran replaces generic `postrun` hooks with a narrow cleanup handoff file:

```text
.runtime/CLEANUP
```

This file is only used for top-level cleanup commands that need to finish work after the managed Alteran process exits.

The cleanup handoff is not a generic command runner. It supports only a small whitelist of cleanup actions.

Initial supported actions are:

```text
DENO_CLEAN
COMPACT
```

`DENO_CLEAN` means that the wrapper should run the managed Deno executable in plain mode:

```text
deno clean [optional args...]
```

`COMPACT` means that the wrapper should:

1. run plain `deno clean` for the active managed Deno runtime;
2. remove the active project runtime directory `.runtime/` after the Alteran process has exited;
3. retry runtime removal a small number of times on Windows to handle transient file-lock release timing.

The cleanup handoff runs only when the main Alteran command exits successfully. If the main command exits non-zero, the wrapper must not execute `.runtime/CLEANUP`.

The wrapper must remove `.runtime/CLEANUP` before executing the requested cleanup action, so that a stale file is not accidentally reused by a later command.

## File Format

The cleanup file is intentionally simple and line-oriented.

For compact:

```text
COMPACT
```

For Deno cache cleanup:

```text
DENO_CLEAN
```

If future `DENO_CLEAN` arguments are needed, they are written one argument per line after the action name:

```text
DENO_CLEAN
--except
npm
```

The format deliberately avoids shell quoting. The wrapper interprets each following line as one argument.

No arbitrary shell commands are allowed.

## Ownership and Concurrency

`.runtime/CLEANUP` is project-local and single-use.

When Alteran needs to create it, it must use exclusive creation semantics. In Deno this should be implemented with `createNew: true` or an equivalent atomic operation.

If `.runtime/CLEANUP` already exists, Alteran must fail the current command with a non-zero exit code and report that another cleanup handoff is already pending.

This prevents two cleanup-producing commands from racing over the same runtime directory.

## Wrapper Responsibilities

The generated Alteran wrapper is responsible for the final handoff step.

Conceptually:

1. run the main Alteran command;
2. capture its exit code;
3. if the exit code is non-zero, exit with that code;
4. if `.runtime/CLEANUP` does not exist, exit with the main command code;
5. read `.runtime/CLEANUP`;
6. delete `.runtime/CLEANUP` immediately;
7. execute the whitelisted cleanup action;
8. return the cleanup action status as the final status when the main command succeeded.

On Unix-like systems this path is expected to be simple, because direct cleanup usually works. The cleanup handoff exists primarily for Windows correctness.

On Windows, runtime directory removal must use path-level retry behavior. Waiting only for `deno.exe` to become unlockable is not sufficient; a target path may fail the first removal attempt and become removable shortly afterward.

## Command Semantics

### `alteran deno clean ...` / `adeno clean ...`

When the user explicitly runs Deno's own cleanup command through Alteran, Alteran should route it to a plain managed Deno invocation rather than through a managed logged/preloaded session.

That is, this should behave like ordinary Deno:

```text
deno clean ...
```

with the project-local managed Deno executable and managed `DENO_DIR`, but without Alteran process logging, preload injection, or extra wrapper behavior beyond normal command dispatch.

### `alteran clean cache`

`clean cache` should delegate Deno cache cleanup to `deno clean` instead of manually deleting Deno cache internals.

When a post-exit handoff is needed, Alteran writes:

```text
DENO_CLEAN
```

The wrapper then runs plain `deno clean` after the main Alteran command exits.

### `alteran clean runtime`

`clean runtime` should remove recoverable runtime-local state while preserving the currently active managed Deno executable path when that executable belongs to the active project.

It may remove stale sibling files such as old executable backups when safe, for example `deno.exe.old`.

Deno cache cleanup should be delegated to `deno clean` rather than implemented by recursive deletion of cache internals from inside the active managed process.

### `alteran compact [dir]`

`compact` has two cases.

If the target directory is not the current active project runtime that the command is running from, Alteran may perform direct cleanup. If some paths cannot be removed, Alteran should report a warning or failure according to the command's chosen policy, but it does not need to use the active-runtime handoff mechanism.

If the target directory is the current active project, Alteran must avoid deleting the runtime tree from inside the active managed process. Instead, it should:

1. remove all safe non-runtime artifacts directly;
2. write `.runtime/CLEANUP` containing `COMPACT`;
3. exit successfully;
4. let the wrapper run plain `deno clean` and then remove `.runtime/` with retries.

`COMPACT` must be the last cleanup phase because it removes the runtime directory that contains the cleanup handoff file and the managed Alteran runtime.

## Dry Run

Cleanup-related commands should support `--dry-run`.

Recommended coverage:

```text
alteran clean <scope> [<scope> ...] --dry-run
alteran compact [dir] --dry-run
alteran compact-copy <destination> [--source=<project-dir>] --dry-run
```

Dry run must not create `.runtime/CLEANUP` and must not delete files.

It should report the planned direct removals and any planned delegated cleanup actions, for example:

```text
Would run: deno clean
Would remove after exit: .runtime/
```

For `compact-copy`, dry run should report what would be copied and what categories would be omitted.

## Logging

The cleanup handoff does not create `postrun.log`, `postrun.msg`, or any equivalent session artifacts.

Cleanup commands are top-level maintenance commands. In particular, `clean logs` and `compact` may intentionally remove the session log tree, so logging the cleanup into the tree being removed is circular and fragile.

The wrapper may print concise warnings or errors to stderr when a cleanup action fails.

## Consequences

Positive:

- much smaller Windows cleanup surface;
- no generated hook scripts inside `.runtime`;
- no self-destructing `.runtime/hooks` tree;
- no postrun log copy-back behavior;
- less batch quoting and label/goto complexity;
- Deno cache cleanup is delegated to Deno itself;
- compact becomes a narrow final cleanup handoff instead of a generic deferred execution framework.

Tradeoffs:

- `.runtime/CLEANUP` is intentionally not a general deferred task mechanism;
- only whitelisted cleanup actions are supported;
- wrapper logic still needs Windows-specific retry behavior for active runtime removal;
- if the wrapper process itself is bypassed, a pending cleanup file may remain and must block later cleanup-producing commands until removed or resolved.

## Rejected Alternatives

### Keep generic run-scoped postrun hooks

Rejected because the generic hook system was larger than the problem. It introduced generated shell and batch scripts, hook directories, logs, message files, and copy-back behavior even though the actual requirement is only cleanup handoff.

### Store cleanup scripts under `.runtime/hooks`

Rejected because `compact` removes `.runtime`. Storing the cleanup mechanism inside the tree being removed creates self-destruction hazards.

### Manually delete Deno cache internals

Rejected because cache layout and locks are Deno-owned concerns. Alteran should delegate cache cleanup to `deno clean` where possible.

### Use arbitrary shell commands in the cleanup file

Rejected because it reintroduces quoting, injection, and cross-platform shell semantics. The cleanup handoff must remain a small whitelist of structured actions.

### Keep logging cleanup into `.runtime/logs`

Rejected because cleanup may intentionally remove `.runtime/logs`. Logging cleanup into the thing being cleaned creates fragile recursive behavior.
