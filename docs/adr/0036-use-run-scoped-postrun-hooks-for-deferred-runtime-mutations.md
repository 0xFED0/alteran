# ADR 0036: Use Run-Scoped `postrun` Hooks for Deferred Runtime Mutations

## Status

Accepted

## Context

Alteran currently performs cleanup and compacting logic from inside the running managed Deno process.

This is workable on Unix-like systems, but Windows introduces an important constraint:

- the active Deno executable and some runtime files can remain locked while the current managed session is still running;
- direct deletion of those files from inside the current Alteran process becomes unreliable or impossible;
- this especially affects commands such as `clean runtime`, `clean all`, and `compact`, which are expected to remove or normalize runtime-local state.

Alteran should solve this without introducing platform-specific magic that changes the conceptual model of the runtime.

In particular, Alteran should avoid a "shadow runtime in temp" design because that would:

- create two competing runtime locations;
- make compacting behavior harder to explain;
- weaken the simple contract that a project has one real local runtime under `.runtime/`;
- add cross-platform complexity that is disproportionate to the actual problem.

At the same time, Alteran should not silently weaken `clean` or `compact` expectations:

- `clean` and `compact` must still result in the intended filesystem state after the command finishes;
- tests must continue to verify the real resulting filesystem state, not only the immediate TypeScript return code.

## Decision

Alteran adopts deferred runtime mutations through root-session-scoped `postrun` hooks.

For a managed invocation with current root run id `{ROOT_RUN_ID}`, Alteran may materialize:

```text
.runtime/hooks/{ROOT_RUN_ID}/postrun.sh
```

or on Windows:

```text
.runtime/hooks/{ROOT_RUN_ID}/postrun.bat
```

Because Alteran's root run id is also the canonical session directory name, this is equivalent to:

```text
.runtime/hooks/{session-dir}/postrun.sh
```

or on Windows:

```text
.runtime/hooks/{session-dir}/postrun.bat
```

Only the hook for the current host platform is generated. Alteran does not create both shell variants for the same run.

If no deferred actions are needed, no hook directory or `postrun` file is created.

## Hook Ownership and Lifetime

`postrun` belongs to the current root Alteran session and is scoped by `ROOT_RUN_ID`, which is also the current `session-dir`.

This means:

- parallel root sessions do not share hook files;
- deferred actions from child runs can safely append into the same root-scoped hook;
- hook ownership is easy to debug and reason about.

After the main Alteran command exits, the generated launcher or wrapper checks whether the current root session has a `postrun` script.

If the script exists, the wrapper:

1. executes it after the managed Deno process has exited;
2. records its live output in a system-temporary location;
3. prints any user-facing `postrun.msg` file to stdout after execution;
4. best-effort copies `postrun.log` and `postrun.msg` back into the canonical session log tree if it still exists;
4. returns the final hook-adjusted exit code to the caller;
5. removes `.runtime/hooks/{ROOT_RUN_ID}` only if the hook completed successfully.

If the hook fails, Alteran leaves `.runtime/hooks/{ROOT_RUN_ID}` in place for debugging.

## Logging and User Messages

`postrun` is treated as part of the current Alteran session, not as a separate session.

Its canonical artifacts therefore belong in the current session log directory, for example:

```text
.runtime/logs/{run-type}/{session-dir}/postrun.log
.runtime/logs/{run-type}/{session-dir}/postrun.msg
```

The exact `{session-dir}` remains whatever canonical per-session directory Alteran already uses for the current root run. In practice, this is the same identifier used in `.runtime/hooks/{session-dir}/...`.

However, `postrun` must not depend on those project-local files remaining available during hook execution, because commands such as `compact` or `clean logs` may intentionally remove the current session log tree.

Alteran therefore writes live `postrun` output to a system-temporary location during execution, for example:

```text
{system-temp}/alteran-postrun/{session-dir}/postrun.log
{system-temp}/alteran-postrun/{session-dir}/postrun.msg
```

After the hook completes, the launcher should:

1. print `postrun.msg` to user stdout when it exists;
2. attempt a best-effort copy of `postrun.log` and `postrun.msg` back into the canonical session log directory, but only if that directory still exists;
3. remove the temporary `postrun` output files.

`postrun.log` should contain:

- the hook intent;
- the path to the generated hook file;
- the hook script contents or equivalent traceable description;
- the execution trace of the hook itself (both stdout and stderr).

The hook should run with shell tracing enabled so that debugging information is visible in `postrun.log`.

`postrun.msg` is optional and is intended for final user-facing summary messages. It is not interactive and must not expect terminal input.

After hook execution, the launcher prints `postrun.msg` to user stdout when that file exists, regardless of whether the canonical session log directory still survived long enough to receive a copied-back copy.

## How `clean` and `compact` Use `postrun`

For runtime-sensitive mutations, Alteran should prefer recording deferred shell commands into `postrun` rather than deleting files directly from the active managed process.

This applies in particular to:

- `clean runtime`
- `clean all`
- `compact`

The hook may be used for other deferred actions in the future as well; it is not restricted to deletions.

For the first implementation, Alteran may represent deferred operations directly as generated shell commands in `postrun.sh` or `postrun.bat`. A structured intermediate plan file is not required.

## Deletion Semantics

For cleanup operations, generated `postrun` commands must be defensive and verify outcomes.

Each deletion step should:

- attempt the removal;
- verify that the target file or directory is actually gone afterward;
- record a failure message into `postrun.msg` when removal did not complete;
- mark the hook as failed.

The hook should aggregate such failures and exit non-zero when one or more deferred operations did not complete successfully.

This allows Alteran to remain truthful:

- no false "completed successfully" message when cleanup was partial or blocked;
- the final command exit code reflects postrun failure, not only the TypeScript phase.

## Clean-Specific Clarifications

`clean runtime` does not change its existing semantic rule about the active managed Deno executable.

Alteran should continue to avoid deleting the currently active managed Deno binary in ways that would destroy the live execution session.

The move to `postrun` does not change that rule.

`clean runtime` also removes hook state as part of runtime cleanup, but because current-run cleanup is now also deferred through `postrun`, this no longer requires special in-process exclusion logic for the active run hook.

## Launcher Responsibilities

The generated Alteran launcher flow conceptually becomes:

1. run the main Alteran command;
2. check whether the current root session created a platform-appropriate `postrun` hook;
3. if present:
   - execute it;
   - write live `postrun.log` and `postrun.msg` output into system temp;
   - print `postrun.msg` if present;
   - best-effort copy `postrun.log` and `postrun.msg` back into the canonical session log dir if it still exists;
   - keep or delete the hook directory depending on success;
   - use the hook result as the final command result when the main command itself succeeded;
4. if absent:
   - behave exactly as before.

This makes deferred mutations a launcher concern rather than an in-process Deno deletion problem.

## Consequences

Positive:

- Windows file locking is handled without inventing a second runtime location;
- the model stays coherent across platforms;
- `clean` and `compact` can remain honest about real filesystem outcomes;
- run-scoped hooks are easy to debug and naturally align with Alteran logging;
- failed deferred cleanup leaves behind a useful hook directory as a debugging indicator.

Tradeoffs:

- launcher logic becomes more important because command success may now depend on postrun execution;
- shell/batch generation must be carefully quoted and validated;
- deferred actions happen one phase later than the main TypeScript command body;
- tests must verify final filesystem state after the whole launcher cycle, not only immediate in-process effects.

## Rejected Alternatives

### Maintain a shadow runtime in a temporary directory

Rejected because it creates a second effective runtime location, complicates compacting semantics, and introduces more conceptual and operational complexity than the Windows locking problem justifies.

### Keep trying best-effort direct deletion from inside the active Deno process

Rejected because it leads to platform-dependent partial behavior and makes Windows cleanup semantics less predictable.

### Introduce both `prerun` and `postrun` hooks immediately

Rejected for now because the current problem is deferred post-exit mutation. A generic `prerun` surface may become useful later, but it is not needed for the present cleanup and compacting problem.
