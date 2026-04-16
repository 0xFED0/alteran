# ADR 0037: Separate Shell Entry Surfaces from Root Bootstrap and Make `enter` the Primary Interactive Entry

## Status

Proposed

## Context

Alteran already distinguishes between:

- public bootstrap surfaces such as `setup` / `setup.bat`;
- generated local activation artifacts such as `activate` / `activate.bat`;
- dynamic environment shaping through `alteran shellenv`;
- project-context rebasing through explicit surfaces such as `setup`, `activate`, `shellenv`, generated app launchers, and `alteran from ...`.

This model is already documented in the main specification and related ADRs:

- ADR 0022 established that public `setup` bootstrap and local activation should be separate concerns;
- ADR 0023 established that project context is project-scoped, not shell-global, and that entering another project is a hard project boundary;
- ADR 0035 established an explicit `from` mode for context-rebased command execution.

As the shell-entry design evolved, a new practical concern appeared:

- keeping multiple shell entry scripts directly in the project root would create clutter;
- hiding them under `.runtime/` would make them harder to discover and would make user-facing entry surfaces feel like internal implementation detail;
- the interactive UX should reflect the intended primary workflow;
- the project should support multiple real host shells (`sh`/`bash`/`zsh`, `cmd`, `powershell`, `pwsh`) without introducing a synthetic Alteran-owned shell.

The previously accepted activation model assumed root-level generated `activate` / `activate.bat`. That remained acceptable while activation was the dominant interactive entry. The design direction has now changed:

- the primary human-friendly interactive workflow should be **entering** the project shell context;
- activation remains supported, but it becomes the more explicit current-shell integration mode rather than the primary newcomer-facing path.

This also intersects with Windows reliability concerns:

- PowerShell support is still desirable and should remain supported for users who intentionally use PowerShell or pwsh;
- however, Windows bootstrap and shell entry should not depend exclusively on PowerShell semantics or execution policy behavior;
- `cmd` remains the most conservative baseline shell surface on Windows;
- for Windows bootstrap plumbing, Alteran should prefer conservative native executables such as `curl.exe` and `tar.exe` over PowerShell-specific web/archive cmdlets where practical;
- Alteran's Windows support baseline should not attempt to exceed the practical minimum Windows baseline already assumed by Deno itself.

A related shell constraint also matters for deactivation:

- an ordinary Alteran process cannot directly mutate the parent shell session environment;
- therefore deactivation cannot be modeled as a plain subprocess that magically edits the caller's session;
- the low-level shell-mutation surface should instead emit shell-native activation or deactivation code and be consumed through the host shell's evaluation mechanism.

## Decision

Alteran adopts a dedicated public `shell/` directory for generated, regenerable, user-facing shell entry surfaces.

### Public root bootstrap surfaces

The project root keeps only the public bootstrap entrypoints:

- `setup`
- `setup.bat`

These remain the visible root-level bootstrap contract for:

- empty-directory bootstrap;
- first-time setup;
- post-transfer re-hydration.

They are public, human-facing, and suitable for source control.

### Public interactive shell surfaces

Interactive shell entrypoints move into a dedicated public directory:

```text
shell/
```

The intended public generated shell surfaces are:

```text
shell/enter
shell/enter.bat
shell/enter.ps1
shell/activate
shell/activate.bat
shell/activate.ps1
```

These files are:

- generated;
- regenerable through `alteran refresh` and `alteran setup`;
- user-facing;
- expected to be easy to find and easy to type;
- not hidden inside `.runtime/`.

They are not treated as temporary runtime debris, but they are also not treated as authored hand-maintained source files.

### Primary interactive entry

`enter` becomes the primary interactive entry surface.

Conceptually:

- `shell/enter*` starts a child shell session in the target project's authoritative Alteran context;
- leaving that context is naturally done through `exit`;
- `enter` is the preferred user-facing way to "go into" a project environment.

This aligns with Alteran's project-context philosophy:

- `external` means "operate on another target from here";
- `from` means "become that target context for a command";
- `enter` means "become that target context for an interactive child shell session."

### Secondary interactive entry

`activate` remains supported, but becomes the explicit current-shell integration mode.

Conceptually:

- `shell/activate*` applies Alteran environment shaping to the current shell session;
- this is useful for shells, editors, or workflows that intentionally want the current session mutated;
- it is not the primary newcomer-facing entry path anymore.

### No separate public `deactivate.*` files

Alteran does not materialize public `deactivate.sh`, `deactivate.cmd`, or `deactivate.ps1` files alongside the public shell entry surfaces.

Instead:

- interactive activation should inject a shell-native `deactivate` command where practical:
  - shell function on Unix-like shells;
  - DOSKEY macro or equivalent convenience mechanism in interactive `cmd`;
  - shell function/alias/scriptblock-level command in PowerShell/pwsh if appropriate;
- Alteran keeps a single low-level shell-mutation surface:

```text
alteran shellenv [--shell=sh|ps|cmd] [--deactivate]
```

This means:

- `alteran shellenv` emits activation code;
- `alteran shellenv --deactivate` emits deactivation code;
- `--shell=sh|ps|cmd` may be inferred by wrappers or passed explicitly when needed.

Because a normal Alteran subprocess cannot directly edit the parent shell environment, `shellenv` is defined as a shell-code emission surface rather than a magical in-place mutator.

That means:

- on Unix-like shells activation or deactivation is expected to be consumed through an evaluation form such as `eval "$(alteran shellenv)"` or `eval "$(alteran shellenv --deactivate)"`;
- on `cmd` the equivalent parent-session application mechanism must be used, for example by generating temporary batch code and `call`-ing it;
- on PowerShell/pwsh it is expected to be consumed through the shell's evaluation mechanism, such as invoking the emitted script text in the current session.

The injected convenience helper `deactivate` should therefore expand to the shell-native equivalent of applying:

```text
alteran shellenv --deactivate
```

rather than depending on a separate low-level `alteran deactivate` command.

### No activation stack

Alteran does not model shell activation as a push/pop stack of project contexts.

The intended model is:

- zero active Alteran project context in the current shell;
- or one authoritative project context.

Activating or entering another project is therefore a context switch, not a nested stack push.

Implications:

- activating the same project again should behave as a no-op or equivalent refresh of the current project context;
- activating another project replaces the Alteran-owned project context rather than stacking it;
- deactivation removes Alteran-owned current-shell context rather than "returning" to a previous project context.

This is consistent with the project-boundary rules from ADR 0023.

### Deactivation ownership model

Deactivation should remove only Alteran-owned current-shell mutations.

In particular:

- Alteran-owned environment variables may be unset or restored according to Alteran's own activation contract;
- Alteran-owned PATH additions should be removed selectively;
- shell aliases, helper functions, and prompt fragments owned by Alteran should be removed;
- unrelated user modifications made after activation should not be blindly erased just because activation happened earlier.

Alteran therefore prefers "remove Alteran-owned changes" over "restore the entire pre-activation shell snapshot wholesale".

### Native host shells only

Alteran does not introduce a synthetic cross-platform Alteran-owned shell as the primary entry experience.

Instead:

- Unix-like systems should use native host shells such as `sh`, `bash`, or `zsh`;
- Windows should support `cmd`, `powershell`, and `pwsh`;
- `cmd` is the most conservative Windows baseline;
- PowerShell and pwsh remain officially supported shell surfaces, but they are not the only viable Windows path.

This preserves host-shell familiarity and avoids expanding Alteran into a pseudo-shell platform.

### Windows support posture

Windows shell support should recognize two separate concerns:

- PowerShell/pwsh users are real users and deserve first-class supported `*.ps1` surfaces;
- the overall project must not become dependent on PowerShell as the only reliable Windows bootstrap or entry layer.

Therefore:

- `shell/enter.ps1` and `shell/activate.ps1` remain valid public surfaces;
- Windows bootstrap and general shell-entry design should continue to allow `cmd`-based conservative workflows;
- PowerShell-specific behavior should not become the sole foundation of Windows support.

### Windows bootstrap tool preference

For Windows bootstrap and setup plumbing, Alteran should prefer conservative native executables over PowerShell web/archive cmdlets.

In practice this means:

- prefer `curl.exe` for HTTP download work;
- prefer `tar.exe` for archive extraction where it is sufficient;
- do not make `Invoke-WebRequest`, `Invoke-RestMethod`, or `Expand-Archive` the primary bootstrap dependency when an equivalent `curl.exe` / `tar.exe` flow is practical.

This does not forbid PowerShell-based fallback behavior, but it does reject a design where PowerShell cmdlets are the primary required transport/extraction layer for Windows bootstrap.

### Windows version support baseline

Alteran should align its minimum practical Windows compatibility with the Windows baseline already supported by Deno.

The intended baseline is therefore:

- Windows 10 version 1709 or newer;
- Windows Server 2016 version 1709 or newer;
- supported Windows architectures follow the Deno-supported baseline relevant to Alteran's runtime model.

Alteran should not add extra complexity in order to preserve support for older Windows releases that fall below the practical Deno runtime baseline.

This simplifies bootstrap assumptions and makes the `curl.exe` / `tar.exe` preference more reasonable.

### Regeneration policy

The `shell/` directory is part of Alteran's generated local state contract.

Its contents are:

- generated by `setup`;
- regenerated by `refresh`;
- expected to stay in sync with current runtime/layout/shellenv behavior.

These files are public-facing generated artifacts, similar in spirit to generated activation launchers, but unlike hidden temporary runtime fragments they are intentionally placed in a stable, easy-to-discover location.

## Consequences

Positive:

- the project root stays clean and focused on true bootstrap surfaces;
- the intended UX becomes visible in the directory layout itself;
- user-facing shell entrypoints remain easy to discover and easy to type;
- `enter` now clearly occupies the primary interactive entry role;
- `activate` remains supported without pretending to be the only or main user path;
- shell-specific support scales better without filling the project root with launcher clutter;
- the decision remains aligned with project-scoped context boundaries and explicit rebasing semantics;
- the deactivation fallback remains honest about shell limitations instead of pretending a child process can mutate its parent session directly;
- Windows bootstrap becomes less dependent on PowerShell-specific behavior and more consistent with conservative native Windows tooling assumptions;
- Alteran avoids carrying legacy Windows compatibility burden below the practical Deno-supported baseline.

Tradeoffs:

- this updates the previously simpler assumption that generated `activate` lives directly in the root;
- documentation, quick start, and tests must be updated to point at `shell/enter*` and `shell/activate*` rather than root-level activation files;
- generated shell surfaces now form a visible public sub-area that must stay stable and documented;
- shell helper regeneration must be treated as part of normal `refresh` consistency;
- low-level deactivation remains an evaluation-based shellenv flow rather than a standalone mutating command, so direct manual use is still more awkward than an injected helper.

## Rejected Alternatives

### Keep all shell entry scripts in the root

Rejected because it would clutter the project root with too many shell-specific entry files and make the root feel like a launcher dump rather than a project root.

### Hide all shell entry scripts under `.runtime/`

Rejected because these shell surfaces are intended to be easy to find, easy to type, and explicitly user-facing. Hiding them under `.runtime/` would make public entry surfaces feel like internal plumbing.

### Keep activation as the only primary interactive entry

Rejected because the preferred human-facing workflow is better modeled as entering a child shell context and leaving it with `exit`, rather than always mutating the caller's current shell.

### Add public `deactivate.*` files beside `enter*` and `activate*`

Rejected because deactivation is more naturally modeled as:

- `exit` for entered child shells;
- injected shell-native helper commands for activated sessions;
- `alteran shellenv --deactivate` as the explicit low-level shell-code-emission fallback.

Materializing more public script files for deactivation would add clutter with limited benefit.

### Treat deactivation as a normal command that directly edits the parent shell

Rejected because subprocesses cannot portably and honestly mutate the parent shell session directly. The correct model is to emit shell-native deactivation code through `shellenv --deactivate` and let the current shell evaluate it.

### Make PowerShell web/archive cmdlets the primary Windows bootstrap dependency

Rejected because it makes Windows bootstrap more dependent on PowerShell policy, version, and cmdlet behavior than necessary, even though equivalent `curl.exe` / `tar.exe` flows are simpler and closer to the practical baseline already used by Deno.

### Support older Windows releases below Deno's practical baseline

Rejected because Alteran is built around the Deno runtime and should not accumulate extra bootstrap complexity solely to preserve Windows versions that fall outside the runtime baseline Deno itself already assumes.

### Introduce an Alteran-owned synthetic shell for consistent behavior everywhere

Rejected because Alteran is a project-local runtime and scaffold manager, not a replacement interactive shell platform. Supporting native host shells preserves familiarity and better fits the project's scope.
