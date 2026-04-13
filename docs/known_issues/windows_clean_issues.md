# Windows Clean Issues

## Summary

Windows cleanup behavior around `clean`, `compact`, and `refresh` is fragile when Alteran is executed from an activated `cmd` session.

The core issue is not simple path handling. It is a combination of:

- Windows file locking semantics
- `cmd`/batch stack behavior around `call`
- `doskey`-based command routing after `activate.bat`
- self-mutation of `.runtime` while the current command path still depends on files inside `.runtime`
- races where files become removable shortly after command completion, but not at the first deletion attempt

At the time of writing:

- `compact` can physically remove the intended paths, but the Windows wrapper/postrun route may still return the wrong final status
- `clean runtime` and `clean builds` still have unresolved Windows race/lock behavior in e2e coverage
- `refresh` has its own related self-mutation problems when invoked from an active managed Windows session

This document records confirmed observations, failed assumptions, and constraints for future work.

## Confirmed Symptoms

### `clean all` / `clean runtime` / `clean builds`

Observed failures included:

- `os error 32` while removing paths under `.runtime/deno/.../cache`
- `os error 5` while removing `.runtime/alteran`
- commands that reported success but left target paths behind
- commands that removed targets only after the process had already exited

Concrete examples:

- active `DENO_DIR` paths such as `dep_analysis_cache_v2` remained locked during the command
- `clean builds` could leave `dist/jsr/artifact.txt`
- `clean runtime` could leave `.runtime/legacy-junk/marker.txt`

### `compact`

Observed failures included:

- trailing `The system cannot find the path specified.`
- earlier versions emitted this twice; later fixes reduced it to once; later fixes removed the `compact` test failure
- `.runtime`, `dist`, and `apps/*/.runtime` were sometimes already physically removed even when the command still looked failed
- in those cases, the remaining problem was often the wrapper/postrun return path rather than the actual deletion work

### `refresh`

Observed failures included:

- attempts to remove `.runtime/alteran` from a process still running out of `.runtime/alteran`
- `os error 5` on `.runtime/alteran`
- noisy trailing path errors in some compacted or partially materialized states

### `setup.bat`

Observed warning:

- `ИНФОРМАЦИЯ: не удается найти файлы по заданным шаблонам.`

This was traced to inner `where deno` stderr not being redirected inside batch `for /f` probing. That warning was a real batch-template issue, not the main cleanup issue.

## Important Windows-Specific Constraints

### 1. This is mostly about locks and batch stack state, not ACLs

In the problematic cases, paths could often be deleted manually a short time later.

That means the main issue was usually one of:

- open file handles
- batch/cmd still unwinding a call stack that references files being deleted
- transient Windows filesystem timing

It was generally not a permanent permission/ACL problem.

### 2. Waiting only for `deno.exe` is not sufficient

A useful partial mitigation was to wait until the active managed `deno.exe` looked unlockable.

However, that did **not** solve all cases.

Reason:

- `deno.exe` may already be unlockable
- but target paths such as `dist` or `.runtime/legacy-junk` may still fail on first deletion attempt
- those same paths may become removable moments later

So Windows cleanup needs path-level retry behavior, not only process-level waiting.

### 3. `cmd` + `call` + deleting currently referenced batch files is dangerous

This is a major source of misleading tail errors.

Alteran on Windows uses:

- `activate.bat`
- `doskey alteran=call "...\\alteran.bat" $*`
- batch wrappers under `.runtime/alteran`

That means a cleanup command can end up deleting files that are still part of the active batch execution route.

Examples of risky deletions:

- `activate`
- `activate.bat`
- `.runtime/alteran/alteran.bat`
- `.runtime/hooks/.../postrun.bat`
- directories containing those files

Even when the main work succeeded, `cmd` could still emit trailing path errors while unwinding.

### 4. `doskey` macros are part of the problem surface

Activated Windows sessions route `alteran`/`alt` through `doskey`.

This means:

- changing generator code is not enough for already-active sessions
- a fresh `call activate.bat` is required to pick up routing changes
- any macro that points directly at `.runtime\\alteran\\alteran.bat` is vulnerable if cleanup later removes that file or its parent directory

### 5. Postrun artifacts stored inside `.runtime` are vulnerable during `compact`

When the deferred hook itself lived under `.runtime/hooks/...` and `compact` removed `.runtime`, this created self-destruction problems.

A temp copy of the hook helped, but did not solve every Windows edge case by itself.

### 6. `cmd` has poor primitives for this problem

Relevant limitations:

- no good built-in sub-second sleep primitive
- brittle quoting behavior
- label/goto flow is easy to break in generated scripts
- poor observability unless extra logs are persisted outside the tree being deleted

PowerShell is much better for:

- short sleeps
- retries
- recursive deletion
- path quoting

But using PowerShell inside generated batch wrappers still does not eliminate the higher-level routing problems above.

## Things That Were Confirmed To Help

These changes were useful, even when they did not fully solve the whole problem set.

### Batch wrapper fixes

Useful fixes included:

- delayed expansion for variables created inside postrun blocks
- restoring `@echo off` after hook execution
- redirecting inner `where deno` stderr in batch templates
- waiting for `deno.exe` unlock before starting Windows postrun
- copying the postrun hook to a temp location before executing it
- copying the main batch wrapper to a temp location before running `clean` / `compact` / `refresh`
- using a temp session wrapper in batch `shellenv` / `activate` routing instead of always pointing macros directly at `.runtime\\alteran\\alteran.bat`

These reduced or removed several classes of false failures.

### Retry behavior on path deletion

One-shot deletion in Windows postrun was not enough.

Confirmed behavior:

- a path could fail deletion during command teardown
- the exact same path could be removed immediately afterward by a normal manual `Remove-Item`

Therefore retry loops against the target path itself are necessary.

## Things That Were Confirmed Not To Be Sufficient

### Waiting only for `deno.exe` unlock

Helpful, but incomplete.

### Executing postrun from a temp hook only

Helpful for `compact`, but incomplete for `clean runtime` and `clean builds`.

### Copying only the main wrapper to temp

Helpful, but not sufficient alone.

### Assuming the error is just noisy stderr

Incorrect for `clean runtime` and `clean builds`.

Later investigation showed real filesystem leftovers:

- `dist` still existed after `clean builds`
- `.runtime/legacy-junk` still existed after `clean runtime`

### Assuming `compact` and `clean` share the same remaining bug

Incorrect.

By the latest state observed during debugging:

- `compact` could reach the correct filesystem end state even when wrapper/postrun status handling was still suspect
- remaining failures were specifically `clean runtime` and `clean builds`

## Reproduced / Verified Facts

These were directly observed during debugging:

1. A path failing deletion during deferred cleanup could often be deleted manually moments later.
2. `compact` targets were often already physically compacted even when earlier versions of the command still emitted trailing batch errors.
3. `clean builds` targets could retain `dist/jsr/artifact.txt` even when the command returned.
4. `clean runtime` targets could retain `.runtime/legacy-junk/marker.txt`.
5. The corresponding leftover paths could then be removed successfully via PowerShell `Remove-Item`.
6. `setup.bat` warning about missing file patterns was unrelated to the core cleanup race.
7. Local `deno test` itself was unstable on Windows in this environment:
   - panic examples included invalid pipe / invalid handle failures
   - this made full local verification harder and increased reliance on targeted repros and test logs

## Test Status Observed During Debugging

At one later stage of debugging, Windows e2e results looked like this:

- `compact` test: passed
- `clean runtime` test: failed because deferred cleanup left legacy runtime entries
- `clean builds` test: failed because deferred cleanup left `dist`

This is important because it means:

- the remaining problem set narrowed
- improvements to macro/wrapper routing were real
- the unresolved piece shifted to actual deferred deletion timing

This should still be read carefully:

- for `compact`, a passing filesystem outcome and a correct final exit/status were not always the same thing during debugging
- several `compact` failures were caused by wrapper/postrun orchestration after deletion had already happened

## Design Implications For Future Work

### High-confidence requirement

Any future Windows cleanup implementation must assume:

- the first delete attempt may fail
- the same path may become removable shortly afterward
- currently executing batch paths must not live inside trees being deleted

### Strong candidates

Future approaches worth considering:

1. A dedicated Windows cleanup worker process outside the current runtime tree.
2. Cleanup orchestration that waits on target-path removability, not only `deno.exe` unlock.
3. Retrying deletion of each target path with logging.
4. Persisting cleanup diagnostics outside the tree being deleted.
5. Reducing dependence on `doskey` + nested `call` stacks for destructive operations.

### Likely architectural direction

If incremental patching keeps failing, a more radical design may be justified:

- spawn a dedicated helper process as the final act
- let the current Alteran process exit
- perform cleanup from the helper after handles are released
- keep logs and status reporting outside the deleted runtime tree

This would be a cleaner model than continuing to extend increasingly complex postrun batch behavior.

## Documentation Notes

This issue is highly Windows-specific.

Linux behavior is not a reliable guide here because Linux allows unlinking open files in ways that Windows does not.

Any future Windows cleanup documentation should make these boundaries explicit:

- successful cleanup on Linux does not imply Windows correctness
- Windows cleanup must be treated as a separate execution model

## Current Takeaway

The unresolved Windows cleanup problem is real and has multiple layers:

- transient locks
- self-mutation of active runtime files
- batch/macro routing that points into deletable trees
- insufficient path-level retry behavior
- weak observability once `.runtime` or its logs are removed

This should not be treated as a small path bug.

It is a Windows execution-model problem.
