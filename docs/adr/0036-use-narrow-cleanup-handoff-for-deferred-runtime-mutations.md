# ADR 0036: Use a Narrow Cleanup Handoff for Deferred Runtime Mutations

## Status

Accepted

## Context

Alteran has a Windows-specific teardown problem around cleanup and compact-style commands.

On Linux and macOS, the current direct cleanup model is acceptable for now. Unix-like systems generally tolerate unlinking open files and do not exhibit the same batch-script and executable-lock behavior that Windows does. As long as the current Unix-like behavior remains correct, Alteran should not introduce extra deferred-cleanup machinery there.

Windows is different:

- the active managed `deno.exe` can keep runtime-local files locked while Alteran command teardown is still in flight;
- deleting the current runtime tree from inside the process tree that depends on it is fragile;
- self-deleting batch files produce control-flow edge cases that do not exist on Unix-like shells;
- `cmd.exe` is especially sensitive to returning into batch files that were deleted while they were still on the batch stack.

Earlier iterations explored:

- generic run-scoped `postrun` hooks under `.runtime/hooks/...`;
- project-local cleanup intent files such as `.runtime/CLEANUP`;
- detached child cleanup via `start`;
- BusyBox `sh`-based cleanup drivers inside the runtime tree.

Those experiments clarified the actual shape of the problem:

- the requirement is narrow, not generic;
- Windows is the only platform currently needing a special handoff;
- the cleanup driver itself must live outside the runtime tree being deleted;
- the wrapper must not return into a deleted batch file;
- plain `deno clean` should be delegated directly to managed Deno rather than reimplemented by recursive cache deletion.

Generic `postrun` is therefore removed as the mechanism for deferred runtime mutations. Alteran no longer treats deferred cleanup as a general shell hook framework.

## Decision

Alteran uses a Windows-only narrow cleanup handoff based on a temporary cleanup batch file located outside the project runtime tree, typically under `%TEMP%`.

This handoff is used only for deferred cleanup and compact-related runtime mutations that are unsafe to finish from inside the active Windows Alteran process tree.

Linux and macOS do not use this handoff for now. They keep the existing direct cleanup path unless future evidence shows that a Unix-side deferred model is needed.

## Windows Handoff Model

On Windows, the generated batch wrapper under `.runtime/alteran/bin/` owns the deferred cleanup handoff.

Conceptually:

1. the wrapper computes a unique temp cleanup batch path outside `.runtime/`;
2. it exposes that path to the Alteran process through environment variables;
3. the Alteran process may choose to materialize a cleanup batch at that path;
4. the wrapper runs the main Alteran command;
5. if the main command exits non-zero, the wrapper exits immediately with that status;
6. if no temp cleanup batch was written, the wrapper exits with the main command status;
7. if a temp cleanup batch exists, the wrapper transfers control to it as the final batch step without using `call`;
8. the temp cleanup batch performs the remaining Windows-only cleanup work and then self-deletes.

The key point is step 7: the wrapper must hand off to the temp cleanup batch without `call`, so that `cmd.exe` does not return into a batch file inside the runtime tree after that tree may already have been removed.

## Temp Cleanup Batch Responsibilities

The temp cleanup batch is Alteran-generated and narrow in scope. It is not a generic user-extensible shell task runner.

Initial responsibilities are:

- run plain managed `deno clean` directly;
- for `compact`, retry runtime directory removal a small number of times on Windows;
- delete itself at the end.

The self-delete tail should use the Windows-safe pattern:

```text
(goto) 2>nul & del /f /q "%~f0"
```

This avoids the noisy `The batch file cannot be found.` tail that can appear when a batch file deletes itself using a plain trailing `del "%~f0"`.

## Command Semantics

### `alteran deno clean ...` / `adeno clean ...`

On Windows, the batch wrapper should intercept this route and invoke plain managed Deno cleanup directly:

```text
deno clean ...
```

This invocation must happen outside `alteran.ts` and outside the normal managed Alteran execution path.

That means:

- no Alteran preload injection;
- no extra Alteran command logging semantics;
- no extra wrapper round-trip back through `alteran.ts`;
- just the managed `deno.exe` with the managed project-local `DENO_DIR`.

After running plain `deno clean`, the wrapper should exit.

### `alteran clean cache`

`clean cache` should delegate cache cleanup to plain managed `deno clean`, not to manual recursive deletion of cache internals.

On Windows this may be done through the temp cleanup batch handoff if post-exit cleanup is required by the active execution context.

### `alteran clean runtime`

`clean runtime` may remove safe runtime-local artifacts directly, but cache cleanup should still be delegated to plain managed `deno clean`.

On Windows, if any part of the remaining cleanup must happen after the main Alteran process exits, Alteran may emit a temp cleanup batch instead of trying to finish inside the active batch/process stack.

### `alteran clean all`

`clean all` may remove direct non-runtime targets immediately, but managed cache cleanup should still go through plain managed `deno clean`.

On Windows this may use the temp cleanup batch handoff for the `deno clean` phase.

### `alteran compact [dir]`

`compact` has two cases.

If the target is not the currently active project runtime, Alteran may clean it directly.

If the target is the currently active project runtime on Windows, Alteran must not try to finish the runtime deletion from inside the active wrapper/process stack. Instead it should:

1. remove safe non-runtime artifacts directly (including removable items inside `.runtime` dir);
2. write the temp cleanup batch outside the runtime tree;
3. exit successfully from the main Alteran process;
4. let the batch wrapper transfer control to that temp cleanup batch without `call`;
5. let the temp cleanup batch run plain managed `deno clean`;
6. retry deletion of the active runtime directory;
7. self-delete.

## Why This Is Windows-Specific

This ADR intentionally limits the special handoff to Windows.

Current Unix-like behavior is not being changed because:

- the underlying file-deletion semantics are different;
- the Windows batch-stack problem does not apply to `sh` in the same way;
- introducing deferred cleanup where it is not needed would add complexity without current evidence of benefit.

If future Linux or macOS failures appear, Alteran may introduce a Unix-side adjustment later. That is out of scope for this ADR.

## Consequences

Positive:

- generic `postrun` is removed from this cleanup path;
- no cleanup intent file inside `.runtime/`;
- no cleanup driver stored inside the tree being deleted;
- no need for BusyBox or other auxiliary shell runtimes for this purpose;
- direct delegation of cache cleanup to `deno clean`;
- `compact` can safely hand off the final Windows-only runtime deletion step without returning into a deleted batch file;
- `alteran deno clean` / `adeno clean` are handled honestly as plain managed Deno cleanup.

Tradeoffs:

- wrapper logic becomes explicitly Windows-specific;
- a temp cleanup batch is still another generated artifact, just outside the runtime tree instead of inside it;
- runtime deletion on Windows may still need small retry windows because file locks do not release deterministically;
- Unix-like platforms intentionally keep separate behavior for now, which means the cleanup model is not fully uniform across platforms.

## Rejected Alternatives

### Keep generic run-scoped `postrun` hooks

Rejected because the problem is narrower than a generic deferred shell execution framework. Hook directories, hook logs, copy-back behavior, and wrapper status plumbing created more complexity than value.

### Store cleanup intent under `.runtime/CLEANUP`

Rejected because the active runtime tree is precisely what `compact` may need to remove. Storing the deferred cleanup contract inside that same tree recreates self-destruction hazards.

### Keep the cleanup driver inside the runtime tree

Rejected because experiments with batch files and BusyBox shell scripts inside the deletable runtime showed that Windows keeps those files awkwardly tied to the active process stack.

### Manually delete Deno cache internals

Rejected because Deno owns its cache layout and locking behavior. Alteran should delegate cache cleanup to plain `deno clean` where possible.

### Change Linux and macOS now to match Windows

Rejected because there is no current evidence that Unix-like platforms need the extra indirection. The Windows workaround should stay Windows-specific until Unix-side failures justify broader change.
