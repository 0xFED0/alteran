# Alteran Specification (Unified Project, Runtime, and Publication Spec)

## 1. Purpose

**Alteran** is a lightweight project-local runtime and scaffold manager for Deno-based automation projects.

Its goals are:

- keep Deno local to the project when desired
- avoid requiring global Deno installation
- provide reproducible project-local cache/runtime layout
- manage multiple apps and tools inside one dev project
- support simple bootstrap from an empty folder
- prepare for future optional GUI/view support without making it central yet

Alteran is **not** currently a desktop framework, IPC framework, or native host platform.

At this stage, `view` is only a placeholder/future extension point.

---

## 2. Core Design Principles

- **Deno is the runtime**
- Alteran is a **project-local bootstrap + manager**
- Runtime files live under **`.runtime/`**
- Alteran exposes a **stable public entrypoint** while keeping its canonical runtime implementation inside the local project runtime
- The system supports:
  - local dev environment
  - standalone app folders
  - future bundling/build flows
- root project structure includes first-class **`apps/`**, **`tools/`**, **`libs/`**, and **`tests/`**
- `view` is optional and not yet fully specified
- no special IPC protocol is required at this stage
- bootstrap shell scripts should stay minimal
- most logic should live in TypeScript, not shell

---

## 3. Main User Flows

### 3.1 Bootstrap an empty project

A user should be able to place or download:

- `setup`
- `setup.bat`

into an empty folder and run them.

These scripts bootstrap the project-local runtime and project skeleton.

### 3.2 Enter dev environment

A user can activate the local environment so `deno` and `alteran` work without global installation.

### 3.3 Manage apps/tools

A user can:

- add apps
- remove apps from registry
- purge app folders
- list apps
- run apps

Likewise for tools.

### 3.4 Reimport/refresh project state

Alteran can:

- scan apps/tools
- sync registries/configs
- update Deno workspace entries
- update aliases
- validate runtime state

---

## 4. Repository and Project Layout

Alteran has two closely related layouts:

- the **Alteran source repository layout**
- the **Alteran-managed project layout**

They should resemble each other where practical, while preserving a clear distinction between repository-only concerns and normal managed project concerns.

### 4.1 Alteran source repository layout

The Alteran source repository should be organized similarly to a real Alteran-managed project, with additional repository-oriented directories.

Suggested repository layout:

```text
repo/
  setup
  setup.bat
  activate
  activate.bat
  alteran.ts
  alteran.json
  deno.json
  deno.lock
  src/
    alteran/
      templates/
    tools/
    libs/
  apps/
  tools/
  libs/
  tests/
  docs/
  examples/
  dist/
    jsr/
    zips/
  .runtime/
```

#### Repository root files

##### `activate`

Generated Unix activation entry for repository development.

It is a local artifact, not the primary public bootstrap surface.

##### `activate.bat`

Generated Windows activation entry for repository development.

It is a local artifact, not the primary public bootstrap surface.

##### `setup`

Unix public bootstrap/setup entry for repository development and empty-project bootstrap.

##### `setup.bat`

Windows public bootstrap/setup entry for repository development and empty-project bootstrap.

##### `alteran.ts`

Public repository-level bootstrap/proxy entrypoint.

It delegates to:

```text
src/alteran/mod.ts
```

This file exists to provide a stable public entrypoint for repository use, bootstrap use, and publication preparation.

It may also include a thin Node.js compatibility bridge whose only purpose is to locate or bootstrap Deno and then re-execute Alteran under Deno.

That bridge does not make Alteran itself a Node-native runtime.

It is not the canonical home of Alteran's internal runtime implementation.

In a normal Alteran-managed project, the materialized runtime still lives at:

```text
.runtime/alteran/mod.ts
```

##### `alteran.json`

Alteran repository/project configuration.

##### `deno.json`

Deno workspace/configuration for the repository.

##### `deno.lock`

Optional but recommended lockfile.

#### Repository directories

##### `src/`

Authored source-of-truth for the Alteran repository itself.

Expected subdirectories include:

- `src/alteran/` — Alteran implementation source
- `src/tools/` — authored runtime-helper tools that may be materialized into `.runtime/tools/`
- `src/libs/` — authored runtime-helper libraries that may be materialized into `.runtime/libs/`

##### `src/alteran/templates/`

Alteran-owned templates and generator modules for regenerable files such as:

- `setup`
- `setup.bat`
- `activate`
- `activate.bat`
- future generated config/bootstrap files

Bootstrap templates such as `setup` / `setup.bat` and generated activation templates such as `activate` / `activate.bat` should be kept as embedded string-based source-of-truth in Alteran-owned TypeScript modules such as:

- `src/alteran/templates/bootstrap.ts`

rather than as neighboring shell-template files that must be read from disk at runtime.

##### `apps/`

Repository-owned example or internal apps.

##### `tools/`

Repository maintenance tools.

This is the correct place for:

- publication scripts
- build helpers
- verification helpers
- sync scripts
- scaffolding helpers
- repository automation logic in general

A separate `scripts/` directory is not required by the spec.

##### `libs/`

Shared repository/project libraries.

##### `tests/`

Repository and project tests.

This is a first-class top-level category, not an afterthought.

##### `docs/`

Documentation.

##### `examples/`

Example Alteran projects and example use cases.

##### `dist/jsr/`

Controlled publication output directory.

This directory is produced by publication tooling.

Each prepared JSR publication should live under a versioned subdirectory:

```text
dist/jsr/<version>/
```

That versioned directory contains the exact package contents that will be published to JSR.

##### `dist/zips/`

Controlled archive/release output directory.

Each prepared archive release should live under a versioned subdirectory:

```text
dist/zips/<version>/
```

This may contain zip assets prepared from the corresponding versioned `dist/jsr/<version>/` bundle for GitHub Releases or similar distribution flows.

Prepared archive/release payloads should include public bootstrap files such as:

- `setup`
- `setup.bat`

They should not include generated local activation artifacts such as:

- `activate`
- `activate.bat`

##### `.runtime/`

Materialized/generated runtime for the repository itself.

In the Alteran source repository, `.runtime/` is not the authored source of truth. It should be reproducible from `src/` and should be ignored by Git.

### 4.2 Alteran-managed project layout

A normal Alteran-managed user project should be organized like this:

```text
project/
  setup
  setup.bat
  alteran.json
  deno.json
  deno.lock
  apps/
  tools/
  libs/
  tests/
  activate
  activate.bat
  .runtime/
```

Optional project directories may include:

- `docs/`
- `examples/`

#### Top-level categories

##### `apps/`

Application entrypoints and app subprojects.

##### `tools/`

User tools and project automation.

##### `libs/`

Project-wide shared libraries.

##### `tests/`

Project tests.

These are intended as a first-class category alongside apps and tools.

##### `.runtime/`

Project-local runtime storage and infrastructure.

### 4.3 Root-level bootstrap contract

In a normal project root, the guaranteed human-facing bootstrap files are:

- `setup`
- `setup.bat`

Generated local activation artifacts may also exist:

- `activate`
- `activate.bat`

The project root should not require a public `alteran.ts` file.

That bootstrap/proxy file exists in the Alteran source repository and publication package, not as a required long-term public file in every managed project root.

### 4.4 `.gitignore` contract

Both the Alteran source repository and Alteran-managed user projects should include a root `.gitignore`.

#### Repository `.gitignore`

The Alteran source repository should ignore generated and machine-local artifacts while keeping authored source code tracked.

At minimum it should ignore things such as:

- the repository-local `.runtime/` tree in full
- generated publication output under `dist/jsr/` and `dist/zips/`
- nested standalone app-local `.runtime/` directories

It should continue tracking authored runtime source such as:

- `src/alteran/`
- `src/tools/`
- `src/libs/`

#### Managed project `.gitignore`

`alteran setup` should create a project-root `.gitignore` for normal Alteran-managed projects.

That project-level `.gitignore` should ignore generated/recoverable local state such as:

- `.runtime/`
- nested app-local `.runtime/`
- generated app launchers such as `apps/*/app` and `apps/*/app.bat`
- reproducible build output such as `dist/`

It should not ignore public bootstrap entrypoints such as root `setup` / `setup.bat`.

If a standalone app scaffold is created outside the main dev project, that standalone app should follow the same policy:

- public app-local `setup` / `setup.bat` stay tracked
- generated app-local `app` / `app.bat` stay ignored

The intent is:

- track user source and config
- ignore local runtime/cache/build artifacts
- make a newly initialized project ready for Git without requiring manual cleanup

---

## 5. `.runtime` Layout

```text
.runtime/
  alteran/
    bin/
      alteran.sh
      alteran.bat
      alt.bat
      arun.bat
      atask.bat
      atest.bat
      ax.bat
      adeno.bat
    mod.ts
    preinit.ts
    logging/
  tools/
  libs/
  logs/
  deno/
    {os}-{arch}/
      bin/
        deno[.exe]
      cache/
```

### 5.1 `.runtime/alteran/`

This directory contains Alteran's own runtime code and infrastructure.

It is the canonical home of the Alteran system inside a project runtime.

Expected contents include:

- `bin/` — generated local CLI wrappers and command shims
- `mod.ts` — main internal Alteran runtime entrypoint
- `preinit.ts` — managed-process preload entrypoint for other scripts (this is prerun hook)
- `logging/` — logging and LogTape integration files
- any additional Alteran implementation modules

### 5.2 `.runtime/tools/`

This directory is for runtime helper tools.

Important distinction:

- these are **runtime-tools**
- not a second copy of the Alteran system
- not an alternate location for the Alteran runtime entrypoint

Runtime-tools may follow the standard helper pattern:

```text
tool.ts
tool/
```

Examples may include helper tools used by the runtime, bootstrap flow, or future view-related work such as `lantea.ts`.

### 5.3 `.runtime/libs/`

This directory is reserved for shared runtime libraries.

It is a future-friendly location for code shared across runtime components.

It is distinct from the user-owned project `libs/` directory.

### 5.4 `.runtime/logs/`

Stores runtime logs according to the logging specification.

### 5.5 Per-platform separation

Platform-specific runtime/cache must be separated by:

- OS
- architecture

Examples:

- `linux-x64`
- `linux-arm64`
- `windows-x64`
- `windows-arm64`
- `macos-x64`
- `macos-arm64`

Current Linux Deno materialization targets GNU-based release archives.

Alpine/musl environments are currently unsupported by Alteran.

This includes environments that already contain a working global `deno`, because Alteran activation switches to a project-local managed Deno runtime after bootstrap.

### 5.6 Why cache is platform-specific

`.runtime/deno/{os}-{arch}/cache` avoids cross-platform cache collisions and keeps runtime artifacts safe and predictable.

### 5.7 No dedicated `.runtime/env/`

The target architecture should not require persistent generated env scripts under `.runtime/env/`.

Environment activation should instead be produced dynamically through `alteran shellenv` and consumed by generated root-level `activate` / `activate.bat`.

---

## 6. Environment Variable

The runtime root is exposed through:

- **`ALTERAN_HOME`**

This variable points to the project-local `.runtime` directory.

It is used by:

- activate scripts
- app scripts
- tool scripts
- runtime helpers

`ALTERAN_HOME` is project-scoped.

It must not be treated as a shell-global Alteran identity that is safe to carry across project boundaries.

When a user enters another project through Alteran bootstrap/activation surfaces such as:

- `setup`
- `activate`
- `shellenv`
- generated `app` / `app.bat`

that target project becomes authoritative and any foreign inherited `ALTERAN_HOME` must be replaced rather than trusted.

### 6.1 Source root override

Alteran may also use:

- **`ALTERAN_SRC`**

This points to an authored Alteran source bundle root, typically something like:

```text
./src
```

where the source bundle contains:

- `alteran/`
- `tools/`
- `libs/`

Alteran, public `setup`, and generated `activate` should treat this as a source-of-truth location from which `.runtime/alteran`, `.runtime/tools`, and `.runtime/libs` may be materialized.

The Alteran source repository may place this in a root `.env` file, for example:

```text
ALTERAN_SRC=./src
```

Alteran should load `.env` as an actual environment file for repository/project commands rather than treating it as a one-off source hint.

When `ALTERAN_SRC` comes from `.env`, path-like values such as `./src`, `../other-src`, `~/dev/alteran/src` must be resolved relative to the directory containing that `.env` file, not relative to the caller's current working directory.

### 6.2 Download source lists

Alteran should support configurable source lists for both Deno and Alteran itself.

Environment variables:

- **`DENO_SOURCES`**
- **`ALTERAN_RUN_SOURCES`**
- **`ALTERAN_ARCHIVE_SOURCES`**
- **`ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES`**

Backward compatibility:

- **`ALTERAN_SOURCES`** may be supported as a legacy alias for `ALTERAN_RUN_SOURCES`

These act as ordered fallback lists.

Rules:

- if the variable is **unset**, Alteran may use its built-in default source list
- if the variable is **set** for `DENO_SOURCES` or `ALTERAN_RUN_SOURCES`, Alteran must use the provided list as-is
- if the variable is **set** for `ALTERAN_ARCHIVE_SOURCES`, Alteran should treat the provided list as user-preferred archive sources and try them before any internal bootstrap handoff sources or built-in defaults
- if the provided list is empty, Alteran must fail with an explicit message telling the user that the list is empty and can be configured via the corresponding environment variable
- when download/bootstrap from one source fails, Alteran must continue to the next source
- if all configured sources fail, Alteran must emit a clear message such as:
  - all configured sources failed
  - check internet connection
  - add/fix mirrors in the relevant source-list variable

#### `DENO_SOURCES`

`DENO_SOURCES` is intended for Deno runtime archive mirrors.

Conceptually, each item is a release-root source from which Alteran can resolve:

- latest-version metadata
- platform-specific Deno release archive

#### `ALTERAN_RUN_SOURCES`

`ALTERAN_RUN_SOURCES` is intended for Alteran bootstrap/runtime sources that can be invoked directly through Deno.

Each item should be treated as a Deno-compatible runnable specifier, for example:

- a JSR package specifier when Alteran is published in a Deno-compatible package form
- an HTTPS URL to a runnable Alteran entrypoint
- another Deno-supported module specifier

This is intentional, but the role of `ALTERAN_RUN_SOURCES` is limited:

- it is for obtaining a runnable Alteran executable
- it is not the canonical source for materializing `.runtime/alteran`
- it may be used to bootstrap a temporary Alteran process that then delegates runtime installation/materialization to local source or archive sources

Reason:

- it preserves support for `jsr:@alteran/alteran`
- it keeps Deno-native specifier support
- it allows mirrors to be either package-oriented or URL-oriented
- it avoids locking the design to raw-file-only distribution
- it avoids treating transient runnable module sources as authoritative install bundles

Until a public Alteran package/source is actually available, the built-in default for `ALTERAN_RUN_SOURCES` may legitimately be empty, in which case bootstrap/update flows must emit the explicit empty-list error described above.

#### `ALTERAN_ARCHIVE_SOURCES`

`ALTERAN_ARCHIVE_SOURCES` is intended for downloadable archive bundles such as GitHub Release zip assets.

It is the public user-facing override/extension mechanism for Alteran archive
installation/materialization sources.

Each item may be either:

- a direct exact archive URL
- a template URL containing `{ALTERAN_VERSION}`

Template expansion should substitute the current Alteran runtime version.
If an item does not contain `{ALTERAN_VERSION}`, Alteran must treat it as an
exact source and use it as-is. It must not guess or infer extra replacement
rules from arbitrary URL shapes.

When `ALTERAN_ARCHIVE_SOURCES` is set, Alteran should try those user-provided
sources first. After exhausting them, it may continue to:

1. internal bootstrap handoff archive sources such as
   `ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES`
2. built-in default archive source templates for the current Alteran version

Alteran should:

- download the archive into a temporary location
- extract it locally
- locate a bootstrapable Alteran entry such as `alteran.ts` with adjacent `src/alteran/mod.ts`
- invoke that local extracted entry through Deno

This allows publication artifacts prepared from `dist/jsr/<version>/` to be reused as bootstrapable archive releases.

Archive sources are the canonical remote source for Alteran runtime materialization/install.

#### `ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES`

`ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES` is an internal bootstrap handoff variable,
not a primary user-facing configuration surface.

Its purpose is to let generated public bootstrap scripts such as `setup` /
`setup.bat` pass their own version-pinned archive fallbacks into the delegated
`alteran setup` TypeScript flow without redefining the meaning of the public
`ALTERAN_ARCHIVE_SOURCES` variable.

Rules:

- generated `setup` / `setup.bat` may populate it with exact version-pinned
  archive URLs derived from the script's own Alteran version
- ordinary users should normally configure `ALTERAN_ARCHIVE_SOURCES` instead
- shell/batch bootstrap scripts should not be required to expand
  `{ALTERAN_VERSION}` placeholders from user-provided archive-source lists
- `ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES` should therefore prefer exact URLs rather
  than template URLs
- when both are present, `ALTERAN_ARCHIVE_SOURCES` remains the higher-priority
  public user preference

This keeps generated bootstrap scripts reproducible and version-pinned while
still allowing a newer `jsr:@alteran/alteran` runtime or explicit user mirrors
to take priority when that is what the user asked for.

---

## 7. Setup and Activate Scripts

### 7.1 Responsibility of `setup` / `setup.bat`

These scripts are the public bootstrap entrypoints.

They may be downloaded into an empty directory and executed directly.

They are responsible for:

1. resolving the location of the `setup` script itself
2. resolving the target project directory:
   - if an explicit path argument is provided, use it
   - otherwise use the directory containing the `setup` script
   - path-like inputs must be normalized carefully:
     - `~` should resolve to the caller's home directory
     - relative paths should become absolute before bootstrap starts
     - behavior must not depend on the caller's current working directory after normalization
3. determining current OS/arch
4. checking whether project-local Deno exists
5. falling back to global Deno if present
6. downloading local Deno into `.runtime/deno/{os}-{arch}/bin/` if needed
7. checking whether the local Alteran runtime entry exists at `.runtime/alteran/mod.ts`
8. obtaining the Alteran runtime material either:
   - from local Alteran repository source material such as `src/alteran/`, `src/tools/`, and `src/libs/`, if available
   - or from remote archive/publication sources as fallback
9. invoking Alteran initialization/setup for the target directory
10. generating local `activate` / `activate.bat` artifacts for later use

Setup scripts must not implement project scaffolding or project synchronization logic themselves.

They only bootstrap enough to run Alteran, then delegate project management to Alteran commands.

Running `setup` against a target project is also a hard project-context boundary.

If the caller shell already contains Alteran runtime/logging variables from a different project, `setup` must not treat that foreign context as authoritative for the target project.

### 7.2 Responsibility of generated `activate` / `activate.bat`

These scripts are generated local activation artifacts, not the primary public bootstrap surface.

They should remain intentionally lightweight.

They are responsible for:

1. exporting absolute-path bootstrap variables such as:
   - `ALTERAN_HOME`
   - `DENO_DIR`
   - `DENO_INSTALL_ROOT`
2. exposing an `alteran` function/shim that uses absolute paths
3. delegating the rest of environment shaping to `alteran shellenv`
4. avoiding runtime self-location/path discovery where generation-time absolute paths are available

Generated `activate` / `activate.bat` are local materialized artifacts, not portable public bootstrap files.

They may assume:

- one concrete project directory
- one concrete `.runtime` layout
- one concrete platform-specific Deno path

They should therefore overwrite project-defining runtime variables for the target project rather than trying to preserve foreign inherited values from another project.

They must not promise to remain valid:

- after moving the project directory
- after copying the generated activation file into a different location
- across OS/architecture changes

If the project is moved or opened on a different OS/architecture, the supported recovery flow is to run `setup` again and regenerate `activate` / `activate.bat`.

For Unix-like shells, generated `activate` should support being sourced:

- `source ./activate`

Entering a project through generated `activate` is a hard project-context switch.

It should not preserve a foreign Alteran execution identity from another project.

Generated Unix `activate` should be sourced-only. Running it as a regular executable should fail with a clear hint to use `source ./activate`. It should not promise useful behavior when invoked as a separate process, because that cannot affect the caller's current shell environment.

#### Source-list behavior during bootstrap

When `setup` / `setup.bat` need to download Deno or obtain Alteran from remote sources, they must:

- read `DENO_SOURCES`
- read `ALTERAN_RUN_SOURCES`, with optional legacy `ALTERAN_SOURCES` aliasing
- read `ALTERAN_ARCHIVE_SOURCES`
- optionally read internal bootstrap handoff sources such as `ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES`
- try runnable Alteran sources first to obtain a temporary executable Alteran
- try archive Alteran sources after runnable sources when no local source/runtime is available for materialization
- iterate over the configured sources in order
- stop on first successful source
- continue to the next source after a failed attempt
- fail with a clear summary if all configured sources fail
- fail immediately with an explicit message if the relevant configured list is empty

Important semantic rule:

- `ALTERAN_RUN_SOURCES` are execution/bootstrap sources only
- `ALTERAN_ARCHIVE_SOURCES` are install/materialization sources
- `ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES` are internal version-pinned bootstrap
  handoff sources, not the main user override surface
- if Alteran was launched from a remote runnable source and there is no local authored source or existing installed runtime, runtime materialization must come from `ALTERAN_ARCHIVE_SOURCES`
- a remote runnable source by itself is not sufficient to authoritatively materialize `.runtime/alteran`

#### Version-aware default archive behavior

Alteran may ship built-in default archive source templates for its own current
version, especially when the public runtime/bootstrap surface is versioned and
the canonical archive payload is also published per version.

For example, when Alteran uses a versioned GitHub Release zip model, the
built-in default archive source may be a template such as:

```text
https://github.com/0xFED0/alteran/releases/download/v{ALTERAN_VERSION}/alteran-v{ALTERAN_VERSION}.zip
```

Generated `setup` / `setup.bat` scripts may embed the exact version-resolved
archive URL corresponding to the Alteran version that generated them.

This is intentional:

- a checked-in or copied historical `setup` script should remain able to
  bootstrap its own version reproducibly
- a newer runnable Alteran entry such as `jsr:@alteran/alteran` may still use
  its own current-version defaults when no stronger user preference is given
- explicit user archive-source configuration remains higher priority than either
  built-in defaults or bootstrap-script handoff sources

### 7.3 Stable bootstrap entry

The public bootstrap/proxy entry remains `alteran.ts` in the Alteran repository and publication package.

In the source repository and publication package, that stable entry may delegate into:

```text
src/alteran/mod.ts
```

In a materialized Alteran-managed project, the effective runtime entry remains:

```text
.runtime/alteran/mod.ts
```

This keeps bootstrap/public usage stable while the materialized project-local runtime remains self-contained under `.runtime/alteran/`.

If `alteran.ts` is invoked from Node.js, it may route into a minimal Node-compatibility bootstrap layer that:

- finds or downloads Deno
- re-executes Alteran under Deno
- preserves Alteran's Deno-oriented execution model

This compatibility is only for the CLI/bootstrap entrypoint. It is not a goal to make the full Alteran runtime/library Node-compatible.

---

## 8. `alteran.ts` and Internal Runtime Entry

`alteran.ts` is the stable public Alteran entrypoint.

It is responsible for exposing the main Alteran command surface while delegating into the canonical project-local runtime entry.

### 8.1 Entry model

The canonical materialized runtime entrypoint inside a managed project is:

```text
.runtime/alteran/mod.ts
```

The authored source-repository/publication entrypoint that backs it is:

```text
src/alteran/mod.ts
```

The public proxy entrypoint is:

```text
alteran.ts
```

This proxy exists in the Alteran source repository and in the publication package.

In those contexts it delegates into the authored source tree, which can then materialize `.runtime/alteran/` for normal projects.

The root `alteran.ts` should stay intentionally thin. Runtime detection such as "Deno vs Node.js" and "is this the main module" may live in a small internal helper module, while the public entrypoint keeps only minimal dispatch logic.

### 8.2 Why this split exists

This split keeps the public entry stable while allowing the authored source tree to live under `src/alteran/` while normal managed projects continue to use the materialized `.runtime/alteran/` layout.

It also avoids treating `.runtime/tools/` as the home of Alteran itself.

### 8.3 Responsibilities

Alteran's runtime implementation is responsible for:

- project initialization
- runtime validation
- environment generation
- app/tool registry management
- workspace synchronization
- alias generation
- refresh/reimport flows
- app/tool scaffolding

### 8.4 Storage strategy

Alteran runtime files are downloaded or materialized during bootstrap and stored locally.

They should **not** be executed from a remote URL on every run.

Using a URL is acceptable only during bootstrap, update, or controlled publication/bootstrap flows.

This includes source-list driven acquisition through `DENO_SOURCES`, `ALTERAN_RUN_SOURCES`, and `ALTERAN_ARCHIVE_SOURCES`.

### 8.5 Command scope model

Alteran commands are divided into two groups.

#### External-project commands

These may operate on a project directory even when that project is not currently activated:

- `setup [dir]`
- `shellenv [dir]`
- `compact [dir]`
- `compact-copy <destination> [--source=<project-dir>]`
- `from app <name> <command> ...`
- `from dir <project-dir> <command> ...`

#### Active-project commands

These operate on the currently activated project and should resolve the project through `ALTERAN_HOME`:

- `refresh`
- `app ...`
- `tool ...`
- `reimport ...`

This keeps project-management commands tied to the active dev environment, while still allowing bootstrap/setup and explicit portability flows to target projects from outside.

The intended normal workflow for another project is therefore:

1. enter that project through `setup`, `activate`, or `shellenv`
2. then run `alteran app|tool|task|run ...` inside that project context

Ordinary command behavior should not imply an advanced cross-project mode where users point `app` / `tool` / `task` families directly at foreign `alteran.json`, `app.json`, or `deno.json` files.

If Alteran supports an advanced cross-project execution mode, it should be spelled explicitly through a dedicated command such as:

```text
alteran external <path-to-json> <command> ...
```

or:

```text
ALTERAN_EXTERNAL_CTX=<path-to-json> alteran external <command> ...
```

Rules for this mode:

- it is visually distinct from ordinary active-project commands
- a positional `<path-to-json>` takes precedence over `ALTERAN_EXTERNAL_CTX`
- supported anchors should be explicit project/app config files such as `alteran.json` or `app.json`
- this mode operates from the caller's current Alteran context rather than becoming the target project's context
- this mode must not silently become a context switch
- this mode must not auto-initialize the target project as if it had been entered through `setup`
- this mode must not write target-owned runtime or canonical log-root state into the foreign target project

Alteran may also support an explicit context-rebased mode spelled as:

```text
alteran from app <name> <command> ...
alteran from dir <project-dir> <command> ...
```

Rules for this mode:

- it is also visually distinct from ordinary active-project commands;
- `from app` resolves `<name>` through the current active project's app registry and then reinterprets the remaining arguments as ordinary Alteran command input in that rebased context;
- `from dir` resolves an explicit Alteran project directory and then reinterprets the remaining arguments as ordinary Alteran command input in that rebased context;
- `from` must not use `deno.json` as an Alteran context anchor;
- `from` must construct an isolated target context instead of silently reusing the caller's active project identity;
- if the target is not yet initialized, `from` should first perform the equivalent of target-local `setup` and only then execute the requested command;
- `from` is therefore the mode whose semantics are "become that project", unlike `external`, whose semantics remain "operate on that target from here".

---

## 9. Environment Activation

The `setup` / `refresh` flow must generate:

- `activate`
- `activate.bat`

These generated root-level scripts are responsible for setting up the dev environment.

### 9.1 Responsibilities of generated activate scripts

They should:

- set `ALTERAN_HOME`
- set `DENO_DIR`
- set `DENO_INSTALL_ROOT` if needed
- add local Deno to `PATH`
- expose a convenient `alteran` command using absolute paths
- delegate dynamic project-specific aliases and additional exports to `alteran shellenv`
- embed concrete absolute paths at generation time instead of rediscovering the script location at activation time

### 9.2 Alias model

Aliases may be implemented through shell alias / DOSKEY-like environment setup rather than generating many executable wrapper files.

This is preferred for dev shells.

### 9.3 `shellenv`

`shellenv` prints environment activation code for the target project.

Like `setup` and generated `activate`, `shellenv` is a project-context switching surface.

It should generate environment code for the target project and should not treat foreign inherited Alteran runtime/logging identity as authoritative across project boundaries.

It should:

- print shell code to stdout
- print logs/diagnostics only to stderr
- compute activation output dynamically from current project state

`shellenv` is intended for interactive activation flows such as:

- Unix: `eval "$(deno ... alteran.ts shellenv)"`
- Windows: generation/use of activation batch code, then `call` it

### 9.4 Activation model

#### Unix-like systems

Preferred activation flow:

1. bootstrap runtime
2. generate or refresh `activate`
3. `source ./activate` or equivalent local activation flow

Generated Unix `activate` should not rely on executed-mode evaluation such as `eval "$(./activate)"`.

Direct process execution such as `./activate` is not a supported activation flow and should fail clearly.

This requires the rule for shellenv:

- stdout = shell activation code only
- stderr = logs, warnings, diagnostics

#### Windows

Preferred activation flow:

1. bootstrap runtime
2. generate or refresh `activate.bat`
3. `call` that file

Windows should not attempt to emulate Unix-style `eval`.

---

## 10. Local Deno Runtime

### 10.1 Global-vs-local rule

Alteran should support this behavior:

- if project-local Deno exists: use it
- else if global Deno exists: use it during bootstrap/setup
- else download project-local Deno

### 10.2 Runtime path

Project-local Deno path:

```text
.runtime/deno/{os}-{arch}/bin/deno[.exe]
```

### 10.3 Cache path

Project-local Deno cache path:

```text
.runtime/deno/{os}-{arch}/cache
```

Alteran should configure Deno to use that path as `DENO_DIR`.

---

## 11. Root `alteran.json`

`alteran.json` is Alteran's own project config. Can be in JSONC format (with comments). Note: if you want to modify jsonc file, please use non-fmt-destructive approach with jsonc-parser edits-modify methods to persist user comment, instead of full clean regeneration file.

It should not be mixed into `deno.json`.

### 11.1 Responsibilities

It stores:

- app registry
- tool registry
- auto-reimport config
- alias and shortcut config
- shell alias config
- refresh behavior config
- project runtime selection such as `deno_version`
- logging configuration
- project metadata

### 11.2 Suggested structure

```json
{
  "name": "MyProject",
  "auto_refresh_before_run": false,
  "deno_version": "2.4.1",
  "logging": {
    "stdout": {},
    "stderr": {},
    "logtape": true
  },
  "shell_aliases": {},
  "apps": {},
  "tools": {},
  "auto_reimport": {
    "apps": {
      "include": ["./apps/*"],
      "exclude": []
    },
    "tools": {
      "include": ["./tools/*"],
      "exclude": []
    }
  }
}
```

Exact schema may evolve, but these concepts must exist. Later sections refine the runtime and logging parts of this file in more detail.

### 11.3 App/tool registry alias fields

Each app or tool registry entry may optionally declare:

- `shell_aliases: ["..."]`

Meaning:

- `shell_aliases` is the exact list of shell alias names Alteran should inject for that entry
- for created or reimported entries whose alias field is missing, Alteran may seed a default first alias such as `app-<name>` or `tool-<name>`
- if `shell_aliases` is present as an empty array or explicit `null`, that disables automatic alias seeding for that entry
- alias names are not implicitly transformed once written into `shell_aliases`; they are injected exactly as written

Alteran-created or Alteran-reimported entries may still default to alias-enabled behavior, but that must become explicit by writing the seeded names into `shell_aliases` rather than depending on hidden runtime generation.

If an entry is reimported and the registry already contains user alias settings for that entry, those settings should be preserved.

### 11.4 Top-level shell aliases

Arbitrary shell convenience aliases do not belong inside an individual app or tool registry entry.

They belong in:

- `shell_aliases`

Example:

```json
{
  "shell_aliases": {
    "myrun": "alt run some/script.ts"
  }
}
```

These aliases:

- are shell UX only
- are injected into generated shell environment output
- are not app/tool identity
- are not prefixed automatically by Alteran

---

## 12. Root `deno.json`

The root `deno.json` configures the whole dev project. Can be in JSONC format (with comments). Note: if you want to modify jsonc file, please use non-fmt-destructive approach with jsonc-parser edits-modify methods to persist user comment, instead of full clean regeneration file.

It may include:

- tasks
- fmt/lint/test config
- imports
- workspace entries

### 12.1 Workspace support

Apps may have their own nested `deno.json`.

The root `deno.json` may list them as workspace members.

Example concept:

```json
{
  "workspace": ["./apps/app1", "./apps/app2"]
}
```

Alteran should maintain these entries when apps are registered, removed, or refreshed.

### 12.2 Import support

The root `deno.json` is also the natural place for Alteran-managed import configuration used by the active project.

In particular, Alteran should maintain the import surface required for:

- `@alteran`
- `@alteran/...`
- `@libs/...`

The exact mechanics may evolve, but the logical import surface defined by this specification must remain stable.

---

## 13. Project Import Mapping, Libraries, and Tests

Alteran-managed projects should expose a stable internal import surface for both Alteran runtime modules and project libraries.

### 13.1 Alteran runtime imports

Inside an Alteran-managed development project, the following logical import mapping should be used:

- `@alteran` -> `.runtime/alteran/mod.ts`
- `@alteran/...` -> `.runtime/alteran/*`

This gives project code a stable internal import surface for Alteran runtime modules and avoids exposing random relative paths into `.runtime/`.

### 13.2 Project libraries under `libs/`

Project libraries are stored under:

```text
libs/
```

Supported entry patterns:

- `libs/name.ts` -> `@libs/name`
- `libs/name/mod.ts` -> `@libs/name`

This is the canonical project-library alias family.

No manifest is required for project libraries.

### 13.3 Why no manifest is needed

Project libraries are not apps or tools.

They are shared code modules, and requiring a manifest for each library would add unnecessary ceremony.

The alias mapping should be inferred from the filesystem structure alone.

### 13.4 Tests under `tests/`

Project tests live under:

```text
tests/
```

This is a first-class top-level category beside `apps/`, `tools/`, and `libs/`.

### 13.5 App-local libraries

An app may also have its own local libraries:

```text
apps/<app>/libs/
```

App-local library entry patterns follow the same convention:

- `apps/<app>/libs/name.ts`
- `apps/<app>/libs/name/mod.ts`

### 13.6 Resolution order for `@libs/...`

When code is executed in app context, the `@libs/...` alias resolves in this order:

1. app-local `apps/<app>/libs/...`
2. project-root `libs/...`

This is intentional.

### 13.7 Shadowing behavior

If both locations provide the same library name, the app-local version shadows the project-root version.

This is valid behavior.

It is not treated as an automatic error.

If a project wants to detect or forbid shadowing, that should be handled by linting, static checks, or a dedicated deduplication tool.

### 13.8 Why a separate `@app-libs/...` alias is not used

A separate alias such as `@app-libs/...` was considered and rejected because it causes unnecessary instability:

- moving a library between app-local and project-root locations would force import rewrites
- exported apps would have awkward import behavior after dependency copying
- the import path would reflect current physical placement instead of stable logical identity

Using a single `@libs/...` alias with local-first resolution avoids those problems.

---

## 14. App Layout

Each app lives under `apps/<name>/`.

Suggested structure:

```text
apps/MyApp/
  app.json
  deno.json
  app
  app.bat
  core/
    mod.ts
  libs/
  view/
```

### 14.1 `app.json`

App-specific metadata/config.

Suggested responsibilities:

- name
- id
- version
- title
- standalone mode flags
- entry configuration
- view flags
- app-local settings

### 14.2 `deno.json`

App-local Deno config and tasks.

### 14.3 `app` / `app.bat`

Standalone app launch scripts.

They should:

- be generated artifacts, not hand-maintained tracked source files
- be directly executable launch entrypoints for end users
- support the user expectation that clicking or launching `app` / `app.bat` starts the application
- not require `source app` or any sourced-shell activation model
- resolve their own directory early and change into it before launching the app
- fail clearly if they cannot determine their own location or cannot confirm they are running from the expected app directory
- validate nearby app markers such as `deno.json` and/or `app.json` before proceeding
- validate that `app.json` contains the launcher's expected app identity marker, at minimum the expected `id`, so a launcher does not silently accept a different app directory that merely happens to contain plausible marker files
- prefer a ready local launcher/runtime path when available
- otherwise fall back to:
  - local app/runtime bootstrap state if already materialized
  - global Deno if sufficient to run app bootstrap
  - app-local `setup` / `setup.bat` when runtime material is missing
- auto-run app-local `setup` / `setup.bat` when needed so the app can self-materialize before first launch
- launch the main app task, equivalent in intent to `alteran app run <name>`

For app launchers, all runtime-sensitive paths should be local to the app directory and should be treated as relative-to-app at launcher design time, not dependent on the caller's current working directory.

### 14.4 `core/`

Contains the main practical logic / automation implementation.

This is the main execution layer for the app.

### 14.5 `libs/`

Optional app-local shared code for that app.

This participates in the `@libs/...` resolution model defined earlier.

### 14.6 `view/`

Placeholder directory for future GUI/view implementation.

At this stage it is reserved but not deeply specified.

---

## 15. Tool Layout

Project tools are reusable TS-based helpers.

At root level they live in `tools/`.

Runtime helper tools live in `.runtime/tools/`.

### 15.1 Tool entrypoint pattern

The standard helper-tool convention is:

```text
tool.ts
tool/
```

This is appropriate for:

- project tools under `tools/`
- runtime helper tools under `.runtime/tools/`

It is **not** the canonical storage model for the Alteran runtime itself, which lives under `.runtime/alteran/`.

### 15.2 Tool library policy

Tools do not need a dedicated tool-local library namespace by default.

Reason:

- the `tools/` area already acts as a natural location for tool code
- if shared code becomes broadly useful, it can be moved into root `libs/`
- introducing a separate tool-local alias family by default would add complexity without enough payoff

---

## 16. App Runtime Rules

### 16.1 Default behavior inside dev project

Apps should use the parent project `.runtime`.

### 16.2 Standalone behavior

If an app is exported or initialized outside the dev project, `app` / `app.bat` may create app-local `.runtime`.

That app-local runtime should contain only what is needed, primarily:

- local Deno if no global Deno
- local cache if needed
- Alteran runtime material needed to launch the app

Standalone app packages should also include canonical app-local `setup` / `setup.bat` bootstrap entrypoints.

Generated `app` / `app.bat` launchers may invoke that app-local setup automatically when the app runtime has not yet been materialized.

Like `setup`, `activate`, and `shellenv`, launching a standalone app through its generated `app` / `app.bat` is a project-context boundary for that app package.

Foreign inherited Alteran runtime/logging identity must not remain authoritative for the launched app.

This means a standalone app should be expected to support:

- first launch with no pre-existing app-local runtime
- automatic local runtime materialization on first run
- later launches using the already materialized local app runtime

The intended UX is "launch the app" rather than "manually activate the app environment first".

### 16.3 Export and packaging rules for libraries

When an app is exported as a source package or standalone application seed, any shared libraries it depends on must be included in the exported package.

This applies to:

- app-local libraries
- project-root libraries referenced through `@libs/...`

### 16.4 Packaging behavior

If an exported app depends on project-root `libs/...`, those required libraries should be copied into the exported package so the exported app remains self-contained.

The exported package may place them into its own `libs/` directory.

This works naturally with the single `@libs/...` alias model.

Because the alias remains the same, no code rewrite is required purely because a library moved from shared-project scope into packaged-app scope.

### 16.5 Relative path resolution

Relative paths in Alteran-managed config are not interpreted relative to the caller shell's current working directory.

They are interpreted relative to the project/config location they belong to:

- root-level config paths relative to the project root / root config file
- app-local config paths relative to the app directory / app-local config file

This prevents accidental `cd` changes from silently changing the meaning of entries such as:

- `./tools/prepare_zip.ts`
- `./apps/hello-cli`
- `./core/mod.ts`

---

## 17. App Tasks

Each app should expose 3 conceptual tasks:

- `core`
- `view`
- `app`

### 17.1 `core`

Runs core/backend logic only.

### 17.2 `view`

Runs the future view logic only.

At this stage it is a placeholder/future hook.

### 17.3 `app`

Runs the application in orchestrated mode, deciding whether to launch `core`, `view`, or both depending on parameters and future app configuration.

---

## 18. Main Commands

Alteran command structure should be explicit.

Preferred pattern:

- `alteran app run MyApp`
- `alteran tool run MyTool`
- `alteran test`

Do **not** collapse `run` into positional magic.

This section establishes the main command-family shape. Later sections refine convenience aliases, Deno passthrough, and version-management commands without changing this core rule.

### 18.1 Command help contract

Alteran should provide built-in help for:

- top-level `alteran --help`
- `alteran help`
- each command family such as `alteran app --help`, `alteran tool --help`, `alteran clean --help`

Command-family help should describe:

- supported subcommands
- accepted argument forms
- important variations or examples

If a command normally requires an argument, passing `--help`/`-h` must show help instead of treating that flag as ordinary data.

---

## 19. App Commands

Supported commands:

- `alteran app add <name>`
- `alteran app rm <name>`
- `alteran app purge <name>`
- `alteran app ls`
- `alteran app run <name>`
- `alteran app setup <path>`

### 19.1 `app add`

Responsibilities:

- register app in `alteran.json`
- update root `deno.json` workspace/tasks as needed
- create app scaffold if the folder does not yet exist

### 19.2 `app rm`

Responsibilities:

- unregister app from Alteran registry
- remove related workspace/task/entry-alias entries
- **must not** delete app files from disk

This removal applies to aliases owned by that app registry entry, not to unrelated top-level `shell_aliases`.

### 19.3 `app purge`

Responsibilities:

- destructively remove app directory/files
- remove from registry/config as well

### 19.4 `app ls`

List registered/discovered apps.

### 19.5 `app run`

Run a registered app.

The effect should correspond to the main app launcher behavior used by generated standalone `app` / `app.bat` scripts, even if the exact bootstrap steps differ between in-project dev mode and standalone app-local mode.

### 19.6 `app setup <path>`

Initialize app scaffold in an arbitrary location outside normal dev context.

---

## 20. Tool Commands

Supported commands:

- `alteran tool add <name>`
- `alteran tool rm <name>`
- `alteran tool purge <name>`
- `alteran tool ls`
- `alteran tool run <name>`

Tools follow the same non-destructive vs destructive distinction:

- `rm` unregisters
- `purge` deletes files

If a tool registry entry owned generated or explicit entry aliases, those entry-scoped aliases should be removed together with the registry entry. Unrelated top-level `shell_aliases` must remain untouched.

---

## 21. Reimport Commands

Supported commands:

- `alteran reimport apps <dir>`
- `alteran reimport tools <dir>`

These commands scan directories and import discovered apps/tools into Alteran-managed config.

They are useful for:

- existing repositories
- external folders
- recovery after manual file changes

---

## 22. Auto Reimport

`alteran.json` should support auto-reimport config.

Suggested key:

- **`auto_reimport`**

With separate app/tool include/exclude patterns.

Example:

```json
{
  "auto_reimport": {
    "apps": {
      "include": ["./apps/*", "x/*/apps/*"],
      "exclude": []
    },
    "tools": {
      "include": ["./tools/*"],
      "exclude": []
    }
  }
}
```

Alteran may use this during refresh.

---

## 23. Refresh Command

Main maintenance/synchronization command:

- **`alteran refresh`**

This command is responsible for bringing the **currently activated project** into a consistent state.

### 23.1 Scope

`refresh` should operate only on the active project resolved through `ALTERAN_HOME`.

It is not intended as a generic external-project initializer.

### 23.2 `refresh` should do things like

- validate `.runtime`
- validate/download missing internal runtime material
- validate `alteran.json`
- validate `deno.json`
- reimport apps/tools according to config
- sync workspace entries
- sync tasks
- sync aliases
- sync Alteran/runtime-related import mappings
- regenerate env scripts if needed
- verify project skeleton consistency
- synchronize the effective local Deno runtime with `alteran.json` configuration, especially `deno_version` if present
- when runtime acquisition/download is needed, use `DENO_SOURCES`, `ALTERAN_RUN_SOURCES`, and `ALTERAN_ARCHIVE_SOURCES` fallback behavior, preferring runnable sources before archive sources

`refresh` is a synchronization command. It should bring the current project into compliance with declared configuration, but it should not silently choose new target versions on its own.

### 23.3 Run without arguments

`alteran` without arguments should **not** automatically perform refresh.

Better behavior:

- show help/status/summary

### 23.4 Optional automatic refresh before run

`alteran.json` may contain:

- `auto_refresh_before_run: true|false`

If enabled, Alteran refreshes before executing a requested command.

### 23.5 Setup Command

Project setup command:

- **`alteran setup [dir]`**

This command is responsible for preparing a project directory so that it becomes a valid Alteran project.

#### Responsibilities of `setup`

- create missing base project files if needed
- create missing directory skeleton if needed
- ensure `.runtime/` exists
- ensure local runtime/tooling is available
- create or repair `alteran.json`
- create or repair `deno.json`
- create or repair `.gitignore`
- create or repair generated activation scripts
- perform a `refresh` as part of setup

When `setup` needs to obtain Deno or Alteran runtime material, it should honor the configured source-list behavior from Section 6.1.

#### Scope

`setup` may target:

- the current working directory
- an explicit external project directory

This makes it suitable for bootstrap flows and for preparing projects outside the currently active shell context.

---

## 24. Generated Shortcuts and Deno Tasks

Alteran should support app/tool registration into:

- Deno tasks
- shell aliases / DOSKEY aliases

This section covers generated shortcuts tied to registered apps and tools. Global convenience aliases such as `alt`, `arun`, `atask`, `ax`, and `adeno` are specified later with the broader command surface.

### 24.1 Deno tasks

Useful for:

- discoverability
- reproducible entrypoints
- dev convenience

### 24.2 Shell shortcuts

Useful inside activated shell sessions.

These do not need to be files in `bin/`. They may be emitted into generated environment scripts.

---

## 25. Internal Runtime-Tool Pattern

Runtime helper tools such as future `lantea.ts` should follow:

```text
tool.ts
tool/
```

### 25.1 Why this pattern

- stable entrypoint
- clean place for helper modules
- simple update model
- supports assets/templates

### 25.2 Scope of this pattern

This pattern applies to helper tools in places such as:

- root `tools/`
- `.runtime/tools/`

It does **not** define the canonical layout of the Alteran runtime itself.

Alteran's own runtime entrypoint is:

```text
.runtime/alteran/mod.ts
```

### 25.3 Import rule

Entry scripts should import from sibling directories relatively, rather than downloading submodules dynamically on every run.

Bootstrap/update should fetch both the entry script and its support folder when this pattern is used.

---

## 26. Clean Command

Alteran should support an explicit cleanup command:

- **`alteran clean <scope> [<scope> ...]`**
- **`alteran compact [dir]`**
- **`alteran compact-copy <destination> [--source=<project-dir>]`**

This command removes generated, downloaded, cached, or otherwise recoverable files.

It must never silently remove user source files or user configuration files.

### 26.1 No implicit default scope

`alteran clean` without a scope should **not** perform any cleanup.

It should instead:

- show help
- show available cleanup scopes
- require the user to explicitly choose what to clean

This keeps cleanup behavior predictable and safe.

When scopes are provided, Alteran should accept one or more scopes in a single invocation and execute them in the order given.

Examples:

- `alteran clean env`
- `alteran clean env logs`
- `alteran clean cache builds`

### 26.2 Supported cleanup scopes

#### `alteran clean all`

Performs a full safe cleanup.

It should remove regeneratable working runtime state while preserving a usable project structure.

It may remove things that can be recreated through:

- `setup`
- `refresh`

It should preserve:

- `setup`
- `setup.bat`
- `alteran.json`
- `deno.json`
- `deno.lock`
- root `apps/`
- root `tools/`
- root `libs/`
- root `tests/`
- app `app.json`
- app `deno.json`
- app `core/`
- app `libs/`
- app `view/`
- other user-authored source/config files

This scope is intended to leave a clean project suitable for sending as a zip archive, while preserving all user-owned sources and configuration.

It should include cleanup equivalent to:

- `alteran clean runtime`
- `alteran clean app-runtimes`
- `alteran clean builds`

#### `alteran compact [dir]`

`alteran compact` is a separate high-level command with no scopes.

It is intended to reduce a project to a compact bootstrap-ready transfer state.

It supports two forms:

- `alteran compact`
- `alteran compact [dir]`

The no-argument form compacts the current active project.

The `[dir]` form compacts an explicit external Alteran project directory, analogous to `setup [dir]`.

Because this is intentionally destructive to local materialized runtime state, it should require an explicit confirmation step by default.

Conceptually it should:

- perform cleanup equivalent to `alteran clean all`
- additionally remove the root `.runtime/` directory entirely
- remove nested `apps/*/.runtime/` directories
- remove `dist/` output entirely

It should preserve:

- `setup`
- `setup.bat`
- `alteran.json`
- `deno.json`
- `deno.lock`
- `.env`
- `.gitignore`
- user source directories such as `apps/`, `tools/`, `libs/`, `tests/`
- other user-authored source/config files

After `alteran compact`, the target project should behave as though Alteran runtime artifacts had never been materialized locally, while still being re-hydratable from scratch through `setup` / `setup.bat`.

#### Confirmation UX

By default, `alteran compact` should:

- print a clear warning describing what will be removed
- explain what will be preserved
- ask for explicit confirmation such as `Are you sure? [y/N]`

It should also support:

- `-y` / `--yes`
- `-f` / `--force`

to auto-confirm and proceed without prompting, and:

- `-n` / `--no`

to auto-cancel.

In non-interactive contexts, `alteran compact` without `-y` / `-f` / `-n` should fail explicitly rather than silently assuming confirmation.

#### `alteran compact-copy <destination> [--source=<project-dir>]`

`alteran compact-copy` is the non-destructive sibling of `compact`.

It should create a transfer-ready compact copy of an Alteran project in a separate destination directory without mutating the source project in place.

If `--source` is omitted, the source project is the current active Alteran project.

If `--source` is provided, Alteran should resolve that directory explicitly as the source Alteran project.

`compact-copy` should:

- create the destination directory or fail clearly if the destination cannot be created;
- copy only authored and bootstrap-ready project material;
- omit runtime, generated activation, build, and other recoverable artifacts that `compact` would remove in place;
- preserve the same authored source and configuration files that `compact` preserves.

The resulting destination should be re-hydratable through `setup` / `setup.bat` exactly as an in-place compacted project would be.

#### `alteran clean cache`

Removes Deno cache contents.

By default, it should clean only the cache for the **current platform**:

```text
.runtime/deno/{os}-{arch}/cache
```

Optional future flag:

- `--all-platforms`

#### `alteran clean runtime`

Removes generated and downloaded runtime contents under `.runtime/`, except where Alteran explicitly decides to preserve the minimum bootstrap state.

This is broader than `cache` and may include:

- platform-local runtime binaries
- generated activation artifacts
- downloaded Alteran runtime material
- generated runtime metadata

This scope should still preserve user-owned project files outside `.runtime/`.

It should also preserve authored runtime source that lives inside `.runtime/`, including directories such as:

- `.runtime/alteran/`
- `.runtime/tools/`
- `.runtime/libs/`

Because `.runtime/` is Alteran-managed internal space, `alteran clean runtime` may also remove unexpected top-level entries under `.runtime/` that are not part of the expected Alteran runtime layout. This includes stale legacy directories left behind by previous layout versions.

When `alteran clean runtime` is invoked from an active Alteran shell session that is currently using the project-local Deno binary, it should preserve that active local `bin/deno[.exe]` so subsequent commands such as `alteran refresh` continue to work without requiring immediate re-activation or re-download.

When runtime-sensitive deletions cannot be completed safely from inside the current managed Deno process, Alteran may use a narrow platform-specific deferred cleanup handoff rather than weakening the cleanup contract.

#### `alteran clean env`

Removes generated activation artifacts such as:

```text
activate
activate.bat
```

Examples:

- `activate`
- `activate.bat`

These files must be recreatable through `setup` / `refresh`.

#### `alteran clean app-runtimes`

Removes nested app-local `.runtime/` directories used by standalone apps.

This scope is intended for app folders that were initialized or exported outside the main dev runtime and later accumulated their own runtime state.

#### `alteran clean logs`

Removes log files and log-derived artifacts under `.runtime/logs/` according to the logging layout specified later in this document.

It must not remove source files or project configuration.

#### `alteran clean builds`

Removes reproducible build and publication output such as:

- `dist/`
- staged release payloads
- other reproducible build artifacts

It must not remove source files.

It must not recreate publication-specific subdirectories such as `dist/jsr/` as part of cleanup. The corresponding build or publication tooling is responsible for recreating its own output directories when needed.

### 26.2 Narrow deferred cleanup handoff

Unix-like cleanup and compact flows should complete directly in the current
process unless a future platform-specific issue requires something stronger.

Windows is different because the active managed Deno process and current batch
launcher can conflict with deletion of:

- the current managed Deno cache;
- the current root `.runtime/` tree during `compact`.

Alteran should therefore use a narrow Windows-only deferred cleanup handoff
rather than a generic project-scoped hook framework.

This handoff should be based on a temporary cleanup batch file located outside
the project runtime tree, typically under the system temp directory.

The generated Windows wrapper owns that handoff.

It applies only to current-runtime mutations that are unsafe to complete from
inside the active Windows Alteran process tree, especially:

- `alteran clean cache`
- `alteran clean runtime`
- `alteran clean all`
- `alteran compact`

It should not be treated as a general deferred hook system for unrelated
commands.

Commands such as:

- `alteran clean builds`
- `alteran clean logs`
- `alteran clean env`
- `alteran clean app-runtimes`

should continue to complete directly unless a future spec changes that contract.

#### `alteran deno clean ...` / `adeno clean ...`

On Windows, the generated batch wrapper should intercept this route and invoke
plain managed `deno clean ...` directly rather than routing it back through
Alteran TypeScript cleanup orchestration.

After plain managed `deno clean` finishes, the wrapper should exit.

#### Exit semantics

The final user-visible command result for cleanup-sensitive commands must
include the deferred cleanup result when the Windows handoff path was used.

This means:

- `alteran clean ...` may return success only if the deferred cleanup batch
  also succeeded when one was required;
- `alteran compact` may return success only if the deferred runtime removal
  also succeeded when one was required.

#### Verification

For Windows deferred cleanup actions, the generated temp cleanup batch must:

- run the required plain managed `deno clean` step when queued;
- attempt the deferred runtime deletion when queued;
- verify that the deferred target is actually gone afterward;
- return non-zero if a required deferred mutation did not complete.

Alteran must not create or depend on a generic `.runtime/hooks/...` tree,
`postrun.log`, or `postrun.msg` as part of this cleanup contract.

### 26.3 Safety rules

The `clean` command must follow these rules:

- never remove user-authored source files by default
- never remove project config files by default
- never remove `deno.lock` by default
- never remove root `tools/`, `libs/`, or `tests/` by default
- never remove app `core/`, `libs/`, or `view/` by default
- only remove files that are recoverable for the selected scope

### 26.4 Future optional flags

The following flags are reasonable future extensions:

- `--dry-run`
- `--yes`
- `--all-platforms`

They are not required for the first implementation, but the command design should leave room for them.

---

## 27. Future `view` Placeholder

At this stage, `view/` is intentionally reserved but under-specified.

Future iterations may define:

- view runtime
- bridge model
- launch model
- web UI integration
- possible `lantea.ts` behavior

For now:

- keep `view/` in app scaffold
- keep `view` task reserved
- do not overdesign it yet

---

## 28. Naming Summary

### Runtime dir

- `.runtime`

### Internal runtime entry

- `.runtime/alteran/mod.ts`

### Stable public proxy entry

- `alteran.ts`

### Runtime env var

- `ALTERAN_HOME`

### Shared project libs dir

- `libs/`

### Shared project libs alias family

- `@libs/...`

### Project tests dir

- `tests/`

### Core app logic dir

- `core/`

### Future view helper

- `lantea.ts`

### Bundle extension

Reserved for future work. Not specified in this document.

---

## 29. Repository Publication and JSR Model

Alteran should use a controlled publication model for its public JSR package.

### 29.1 Publication output directory

Publication is prepared under:

```text
dist/jsr/<version>/
```

This versioned directory is generated by publication tooling.

It is the exact source of truth for what gets published to JSR for that version.

Unversioned top-level payload files directly under `dist/jsr/` are legacy layout artifacts and should not be left behind by current publication tooling.

The version string should come from Alteran's authored version source under `src/alteran/`.

Zip/release artifacts may additionally be prepared under:

```text
dist/zips/<version>/
```

### 29.2 Why publish from `dist/jsr/<version>/`

This model is preferred because it:

- makes publication contents explicit
- prevents accidental publication of unrelated repository files
- allows validation that the package contains exactly what `setup` needs
- separates development layout from publication layout
- improves confidence in reproducible publishing

### 29.3 Publication tooling

Publication helpers should live in repository `tools/`.

Typical responsibilities may include:

- preparing `dist/jsr/`
- optionally preparing `dist/zips/<version>/`
- copying required files
- generating `jsr.json`
- generating archive artifacts such as zip releases
- generating standalone bootstrap-script release assets such as versioned
  `setup` / `setup.bat`
- validating package completeness
- running dry-run publication checks
- publishing the final package

### 29.4 Public JSR package goal

The intended public command is:

```bash
deno run -A jsr:@alteran/alteran setup
```

Therefore the Alteran package should publish a root entrypoint for the package itself, not only a subpath CLI module.

### 29.5 Package naming

The target package identity is:

```text
@alteran/alteran
```

### 29.6 Public package entry vs programmatic API

`@alteran/alteran` is primarily a CLI-oriented package.

Its main responsibility is to serve commands such as:

```bash
deno run -A jsr:@alteran/alteran setup
```

If Alteran exposes programmatic APIs such as:

```ts
import { setup } from "@alteran/alteran/lib";
await setup(dir);
```

those should live under a library-oriented subpath such as:

```text
@alteran/alteran/lib
```

This keeps the split clear:

- `@alteran/alteran` -> CLI/bootstrap entry
- `@alteran/alteran/lib` -> programmatic API

### 29.7 Publication package contents

The published JSR package should contain everything needed for the public bootstrap/setup flow.

In particular, it must contain enough Alteran runtime material so that:

- the public package entry can run `setup`
- `setup` can copy or materialize the required runtime files into the target project's `.runtime/`
- the resulting initialized project can operate correctly from its local runtime

In practice, the publication package may ship the authored source bundle under `src/` and use that as the source-of-truth from which the target project's `.runtime/` is materialized.

Publication/release payloads should include public bootstrap files such as `setup` / `setup.bat`.

They should not include generated local activation artifacts such as `activate` / `activate.bat`, because those belong to post-setup local project state rather than to the public release surface.

This means the publication package is not just a thin remote stub.

It is the seed from which project-local Alteran runtime state can be created.

### 29.8 Documentation expectations

The generated `dist/jsr/<version>/` package should include explicit package metadata such as:

- package name
- version
- exports
- publication configuration
- a local workspace `deno.json` suitable for `deno publish` from the prepared version directory

This may be expressed through `jsr.json` or equivalent supported package metadata.

Repository code intended for publication should use JSDoc appropriately so JSR can generate useful package documentation.

The repository should also maintain:

- `README.md`
- `docs/`

Prepared JSR publication bundles should copy `README.md` into the versioned JSR
package.

They should not copy the full `docs/` tree into the staged JSR package by
default, because the JSR package page already renders `README.md` and its links
can point to repository-hosted documentation.

Archive artifacts such as release zips should include both `README.md` and
`docs/`, so downloadable release bundles remain understandable outside the JSR
package page itself.

Release zip artifacts should not include publication-only metadata such as the
publish workspace `deno.json` or `jsr.json`, because those files exist for JSR
publication mechanics rather than for runtime bootstrap from downloaded archives.

Versioned GitHub Release publication may also attach standalone bootstrap
scripts next to the archive asset itself, for example:

- `alteran-v<version>.zip`
- `setup-v<version>`
- `setup-v<version>.bat`

These assets should live on the same release as the matching version tag.

The versioned filenames are intentional:

- they make downloaded assets self-describing during debugging and support work
- they make it obvious which bootstrap script or archive was actually executed
  after copying files around
- they reduce ambiguity when multiple release assets from different versions are
  present in the same local download directory

The non-versioned canonical script names inside prepared project roots remain:

- `setup`
- `setup.bat`

But standalone release assets may use versioned filenames for clarity while
still containing the normal bootstrap script payload for that version.

### 29.9 Dedicated JSR publish flow

Alteran may provide a dedicated publication helper such as `publish_jsr`.

Its normal behavior should be:

- if `--version` is omitted, treat it as `current`
- `current` prepares and publishes the current repository version
- `latest` publishes the latest already-prepared staged version under `dist/jsr/`
- an explicit semantic version publishes that already-prepared version directory
- `--dry-run` may be forwarded to the underlying `deno publish` invocation so
  maintainers can validate the real publish path without creating a release
- empty token environment variables should be treated as unset rather than as an
  explicit invalid token value

When `publish_jsr` runs in GitHub Actions, it should allow tokenless OIDC-based
authentication when the JSR package is linked to the repository and the job has
`id-token: write`.

Because `deno publish` requires the config being published to belong to a workspace,
each prepared `dist/jsr/<version>/` directory may include a local publish workspace
config such as `deno.json` with `workspace: ["."]`.

---

## 30. Minimal Bootstrap Contract

A minimal bootstrap flow from an empty folder should be possible with:

```bash
curl <bootstrap-url> | sh
```

or equivalent downloaded `setup` script.

This must be able to:

- create `.runtime/`
- materialize the Alteran runtime under `.runtime/alteran/`
- download or install local Deno if needed
- initialize base project files if missing
- prepare activation scripts
- make the project usable without global Deno installation

---

## 31. Non-Goals (Current Iteration)

The following are explicitly out of scope for this iteration:

- native desktop shell runtime
- custom IPC protocol
- Lantea/WebUI specifics
- mobile runtime details
- app bundle format details
- binary packaging details
- detailed GUI/view specification

These may be added later.

---

## 32. Implementation Summary

Alteran should currently be implemented as:

1. a bootstrapable local Deno environment manager
2. a project scaffold generator
3. a multi-app / multi-tool registry manager
4. a refresh/sync tool for project structure and runtime state
5. a command router with a stable public entrypoint `alteran.ts` delegating to `.runtime/alteran/mod.ts`
6. a local runtime layout under `.runtime/`
7. an explicit command surface with app/tool families, Deno passthrough, and version-management commands
8. a project structure with first-class `apps/`, `tools/`, `libs/`, and `tests/`
9. a logging system with stdout/stderr capture plus structured event logs
10. a controlled JSR publication model rooted at `dist/jsr/<version>/`, with optional archive artifacts under `dist/zips/<version>/`
11. a future-ready system with reserved `view` hooks, but without committing to GUI architecture yet

---

## 33. Managed Preinit and Deno Execution

Alteran-managed script execution should support a preload-based process initialization model.

### 33.1 Preinit entrypoint

A dedicated preload module must exist:

```text
.runtime/alteran/preinit.ts
```

This module is intended to be passed through Deno's preload mechanism when Alteran runs scripts and tasks in its managed environment.

### 33.2 Purpose of `preinit.ts`

`preinit.ts` is responsible for process-local Alteran initialization before the target user script executes.

Examples of responsibilities:

- initialize Alteran runtime context
- expose runtime metadata and helpers
- configure logging hooks or runtime integrations
- load Alteran-aware environment state
- prepare process-level helper APIs needed by managed scripts

This preinit hook is also the natural place for Alteran-managed logging bootstrap, especially when structured logging integrations are enabled.

It should not perform destructive project synchronization by itself.

### 33.3 Managed run/task model

Conceptually:

```text
deno run --preload=.runtime/alteran/preinit.ts <target>
deno task --preload=.runtime/alteran/preinit.ts <task>
```

This means:

- plain `deno run` remains plain Deno behavior
- plain `deno task` remains plain Deno behavior
- `alteran run` and `alteran task` run inside Alteran-managed process initialization

### 33.4 User-facing distinction

Users should understand the distinction:

- `deno run` / `deno task` = honest plain Deno
- `alteran run` / `alteran task` = Alteran-managed execution
- `alteran deno ...` = Deno itself executed inside Alteran environment

---

## 34. Command Aliases and Deno Passthrough

Alteran should support a concise but explicit command surface.

### 34.1 Primary command and short alias

Primary command name:

- **`alteran`**

Recommended short alias:

- **`alt`**

This should be the standard short interactive alias.

### 34.2 Convenience aliases

Recommended convenience aliases:

- **`arun`** -> `alteran run`
- **`atask`** -> `alteran task`
- **`atest`** -> `alteran test`
- **`ax`** -> `alteran x`
- **`adeno`** -> `alteran deno`

Project-specific entry aliases are a separate mechanism.

Rules:

- entry aliases come from each app/tool registry entry's `shell_aliases`
- for created or reimported entries whose `shell_aliases` field is absent, Alteran may seed a first default alias such as `app-<name>` or `tool-<name>`
- if `shell_aliases` is present as `[]` or `null`, that disables default alias seeding for that entry
- arbitrary shell shortcuts belong under top-level `shell_aliases`, not under app/tool registry identity alone

### 34.3 Preferred alias for Alteran-managed Deno passthrough

Preferred alias:

- **`adeno`**

This is preferred over:

- `altdeno`
- `altd`

Reason:

- short enough
- explicit
- easy to understand as “Alteran Deno”
- consistent with `alteran deno` as a passthrough/proxy entrypoint

### 34.4 Non-recommended aliases

Avoid:

- plain `run`
- plain `task`
- `drun`
- `dtask`

These are either too generic or add unnecessary alias complexity.

### 34.5 `alteran deno`

Alteran should provide managed passthrough commands for Deno.

`alteran deno` runs Deno inside the Alteran environment.

This is useful when the user wants raw Deno behavior, but with Alteran runtime resolution and environment variables already applied.

Examples:

- `alteran deno run ...`
- `alteran deno task ...`
- `alteran deno test ...`
- `alteran deno upgrade --version=...`

Alias:

- `adeno`

`alteran deno` should be treated primarily as a passthrough/proxy namespace, not as a large Alteran-specific command family.

### 34.5.1 `alteran test`

Alteran should provide:

- **`alteran test`**

This is a convenience shortcut for:

```text
alteran deno test ...
```

It should behave like `deno test`, but executed inside the Alteran-managed environment.

Examples:

- `alteran test`
- `alteran test tests/foo_test.ts`
- `alteran test --filter my_case`

### 34.6 `alteran x`

`alteran x` is equivalent in spirit to `deno x`, but executed inside the Alteran environment.

Alias:

- `ax`

---

## 35. Update, Upgrade, Use, and Deno Version Management

Alteran should clearly separate project dependency update, tooling upgrade, configuration mutation, and configuration synchronization.

### 35.1 `alteran update`

Alteran should provide:

- **`alteran update`**

This command is conceptually equivalent to running Deno dependency updates for the current project.

Its role is:

- update project dependencies
- refresh lock/update state as appropriate
- behave similarly to `deno update`

It should not update:

- the Deno runtime binary itself
- Alteran itself

### 35.2 `alteran upgrade`

Alteran should provide:

- **`alteran upgrade`**

Default behavior:

- upgrade Alteran itself

This command is for upgrading installed tooling, not for editing project configuration.

When `upgrade` needs to download Alteran or Deno, it should honor the source-list behavior from Section 6.1.

### 35.3 Explicit upgrade targets

Supported forms should include:

```text
alteran upgrade --alteran
alteran upgrade --alt
alteran upgrade --alteran=<version-spec>
alteran upgrade --alt=<version-spec>
alteran upgrade --deno
alteran upgrade --deno=<version-spec>
alteran upgrade --alteran --deno
alteran upgrade --alteran=<version-spec> --deno=<version-spec>
```

Behavior:

- `--alteran` / `--alt` explicitly target Alteran itself
- `--deno` explicitly targets the Alteran-managed Deno runtime
- each flag acts as both target selector and optional version carrier
- if no version is specified for a selected target, Alteran should use the latest appropriate version for that target

### 35.4 `alteran use`

Alteran should provide:

- **`alteran use --deno=<version-spec>`**

This command sets the project's desired Deno version in `alteran.json`.

Example:

```text
alteran use --deno=2.4.1
```

Behavior:

- validate the provided version/specifier
- write `deno_version` into `alteran.json`
- either apply it immediately or instruct the user to run `alteran refresh`, depending on the final implementation choice

This is the preferred place for project config mutation related to Deno version selection.

### 35.5 Single-version Deno policy

Alteran manages only one Deno version per runtime.

It does **not** support multi-version Deno management inside one `.runtime`.

There is exactly one effective Deno version per Alteran runtime.

### 35.6 `deno_version` in `alteran.json`

`alteran.json` may contain:

```json
{
  "deno_version": "<version-spec>"
}
```

This version spec is the desired Deno version for the project.

It may be:

- an exact version
- a version range/specifier, if Alteran chooses to support them
- omitted, in which case Alteran is free to use its default bootstrap/runtime policy

### 35.7 Runtime resolution rule

When Alteran needs Deno, it should:

1. check project-local Deno in `.runtime/deno/{os}-{arch}/bin/`
2. if global or parent Deno is available and satisfies the configured version constraint, it may be used during bootstrap/setup flows
3. if no available Deno satisfies the configured version requirement, Alteran downloads an appropriate local Deno into the project runtime
4. once local runtime is established, project execution should prefer the local Deno

### 35.8 `alteran refresh`

`refresh` is the synchronization command for project state and runtime state.

Behavior:

- if `alteran.json` contains `deno_version`, bring local Deno into compliance with that configured specifier
- if no `deno_version` is configured, follow Alteran's default bootstrap/runtime policy without mutating config

`refresh` should not silently choose new target versions on its own.

### 35.9 `alteran upgrade --deno[=...]`

Alteran should support upgrading the Alteran-managed Deno runtime through the top-level command.

Supported forms:

```text
alteran upgrade --deno
alteran upgrade --deno=<version-spec>
```

Behavior:

- this is a convenience wrapper over `alteran deno upgrade`
- `alteran upgrade --deno=<version-spec>` should map conceptually to `alteran deno upgrade --version=<version-spec>`
- `alteran upgrade --deno` should map conceptually to `alteran deno upgrade`

This command upgrades the installed Alteran-managed Deno runtime.

It should **not** rewrite `alteran.json` by default.

If the installed/runtime Deno and configured `deno_version` diverge, Alteran may emit a warning, but config mutation should remain an explicit action via `alteran use --deno=...`.

### 35.10 `alteran deno upgrade`

Supported form:

```text
alteran deno upgrade [--version=<version-spec>]
```

Behavior:

- acts as a passthrough/proxy invocation of Deno upgrade behavior within the Alteran environment
- preserves the underlying Deno upgrade semantics rather than reimplementing separate Alteran-specific logic
- applies to the Alteran-managed local runtime, not the global/system installation

### 35.11 `DENO_INSTALL_ROOT`

Alteran shell environment may need to set:

- **`DENO_INSTALL_ROOT`**

so that local Deno installation and upgrade flows place binaries into the correct project-local runtime directory.

This is especially relevant for `alteran deno upgrade` and `alteran upgrade --deno`.

### 35.12 Global Deno safety rule

Alteran must never modify the global/system Deno installation.

All Alteran-managed upgrades apply only to the project-local runtime.

---

## 36. Logging Model

Alteran should provide a logging system for CLI invocations, managed Deno execution, structured events, runtime capture, and optional LogTape integration.

This logging model builds on the managed execution model from Section 33 and is extended by the LogTape-specific integration rules in Section 37.

The goals are:

- preserve clean machine-readable stdout where required
- provide reliable stdout/stderr capture for root invocations
- provide structured event logging through JSONL
- support optional LogTape-based application logging
- keep logging infrastructure opt-in and non-invasive
- maintain coherent parent/child process traceability

### 36.1 Logging outputs

Alteran supports three logging output forms:

- `stdout`
- `stderr`
- `events.jsonl`

`stdout` and `stderr` are process stream captures. They are not structured logging channels by themselves.

`events.jsonl` is the structured event stream.

It contains:

- Alteran lifecycle events
- structured log records
- process execution events
- process spawn/exit metadata
- optional user/application LogTape events
- any other runtime event Alteran chooses to emit in structured form

Each line is one JSON object.

### 36.2 Logging configuration in `alteran.json`

Logging is configured under the `logging` key:

```json
{
  "logging": {
    "stdout": {},
    "stderr": {},
    "logtape": true
  }
}
```

Supported top-level keys:

- `logging.stdout`
- `logging.stderr`
- `logging.logtape`

`logging.stdout` and `logging.stderr` control stream capture and console mirroring behavior.

Their exact schema may evolve, but they are intended to control things such as:

- whether output is mirrored to the console
- whether stream capture is enabled
- buffering/flush policy
- retention or size-related behavior
- future stream formatting or filtering options

### 36.3 `logging.logtape`

`logging.logtape` is optional.

If absent or `false`:

- LogTape is considered disabled
- Alteran does not require the LogTape package
- Alteran does not bootstrap LogTape
- the `@logtape/logtape` proxy remains inert and only re-exports the original package behavior

If set to `true`:

- LogTape is enabled
- Alteran applies its default LogTape configuration
- LogTape infrastructure is bootstrapped automatically in Alteran-managed execution

If set to an object:

- LogTape is enabled
- the object is treated as user LogTape configuration
- Alteran default configuration is deep-merged with the provided object
- if the user wants a full reset instead of merge, LogTape's own reset mechanism may be used

For `logging.logtape: { ... }`, Alteran default configuration is the base and the user object is deep-merged over the defaults.

### 36.4 Log storage layout

Logs are stored under:

```text
.runtime/logs/
```

This is the canonical project-local log root.

Even if Alteran later supports a user-provided external copy target such as `ALTERAN_CUSTOM_LOG_DIR`, the canonical root for invocation identity and metadata remains under the current project's `.runtime/logs/`.

The top-level directories are:

```text
.runtime/logs/apps/
.runtime/logs/tests/
.runtime/logs/tools/
.runtime/logs/tasks/
.runtime/logs/runs/
```

The top-level log directory is chosen based only on the root invocation type.

Root invocation categories:

- `apps` for app-like entrypoints launched through `alt app run`
- `tests` for test-oriented entrypoints such as `alt test` and `alt deno test`
- `tools` for registered tools launched through `alt tool run`
- `tasks` for task execution launched through task-oriented entrypoints
- `runs` for script/file execution launched through run-oriented entrypoints

Child processes do not change the top-level directory.

All logging for the invocation tree belongs to the root invocation directory determined by the root call.

### 36.5 Per-invocation directory

Inside each top-level directory, each root invocation gets:

```text
{run_id}_{name}/
```

Example:

```text
.runtime/logs/tests/20260331T181450Z_sample-test-ts/
.runtime/logs/tasks/20260331T181501Z_build/
.runtime/logs/runs/20260331T181530Z_seed-db/
```

Each invocation directory contains:

```text
stdout.log
stderr.log
events.jsonl
metadata.json
```

This layout provides chronological sorting, human-readable identification, and a stable root directory for all logs of that invocation tree.

### 36.6 `metadata.json`

Each root invocation directory should contain `metadata.json`.

Recommended fields:

```json
{
  "type": "task",
  "name": "build",
  "run_id": "20260331T181501Z_build",
  "root_run_id": "20260331T181501Z_build",
  "parent_run_id": null,
  "cwd": "/project",
  "argv": ["alt", "task", "build"],
  "started_at": "2026-03-31T18:15:01Z",
  "finished_at": "2026-03-31T18:15:08Z",
  "exit_code": 0,
  "pid": 12345,
  "alteran_version": "x.y.z",
  "deno_version": "a.b.c"
}
```

The intent of `metadata.json` is to describe the root invocation in a compact form, allow quick debugging without parsing `events.jsonl`, and preserve execution metadata even if logs are later rotated or partially truncated.

### 36.7 Invocation identity

Alteran must track invocation identity across parent/child execution.

Important identifiers:

- `run_id` — identifier of the current invocation/process scope
- `root_run_id` — identifier of the root invocation tree
- `parent_run_id` — identifier of the direct parent invocation, if any
- `ALTERAN_RUN_ID` — environment variable exposing current invocation id

Recommended additional metadata:

- `depth`
- `name`
- `type`

These identifiers should be available in structured events and, where useful, via environment variables.

For root-scoped logging purposes, `root_run_id` is also the canonical session directory name.

### 36.8 Environment variables for logging context

Alteran should propagate logging context into child processes through environment variables.

Recommended variables:

- `ALTERAN_RUN_ID`
- `ALTERAN_ROOT_RUN_ID`
- `ALTERAN_PARENT_RUN_ID`
- `ALTERAN_ROOT_LOG_DIR`
- `ALTERAN_LOG_MODE`
- `ALTERAN_LOG_CONTEXT_JSON`

`ALTERAN_ROOT_LOG_DIR` must always point at a canonical project-local root log directory under:

```text
<project>/.runtime/logs/<category>/<run-id>
```

It must not be replaced by an external custom copy destination.

If Alteran supports a custom log mirror/copy destination such as `ALTERAN_CUSTOM_LOG_DIR`:

- canonical root metadata such as `metadata.json` still belongs under the project-local `.runtime/logs/...`
- `ALTERAN_ROOT_LOG_DIR` still points to that canonical project-local location
- the custom location is only an additional copy/mirror target

Inherited logging context is valid only when it belongs to the current project.

In practice this means:

- the inherited `ALTERAN_ROOT_LOG_DIR` must lie inside the current project's `.runtime/logs/`
- inherited `ALTERAN_RUN_ID` / `ALTERAN_ROOT_RUN_ID` must be coherent with that canonical root session metadata

If inherited logging variables are foreign or inconsistent, Alteran should self-heal by starting a fresh root session for the current project rather than failing hard by default.

`ALTERAN_LOG_CONTEXT_JSON` should be a JSON string with a recommended shape like:

```json
{
  "context": {
    "run_id": "20260331T181501Z_build",
    "root_run_id": "20260331T181501Z_build",
    "parent_run_id": null,
    "name": "build",
    "type": "task"
  },
  "category": ["alteran", "task", "build"]
}
```

This is preferred over comma-separated strings because it is less ambiguous, easier to extend, avoids delimiter issues, and is future-proof for richer metadata.

`ALTERAN_LOG_CONTEXT_JSON` is an internal Alteran-managed propagation payload for lightweight parent/child logging context. It must not be treated as a general user-facing configuration mechanism, and heavy LogTape configuration should not be serialized through environment variables.

Recommended `ALTERAN_LOG_MODE` values are:

- `root`
- `child`
- `disabled`

### 36.9 Stream capture model

Alteran must distinguish between stream capture and structured events.

The capture layer is responsible for:

- capturing stdout and stderr from the root invocation tree
- appending captured output to `stdout.log` and `stderr.log`
- optionally mirroring those streams to the console according to `logging.stdout` / `logging.stderr`

The event layer is responsible for:

- writing structured events to `events.jsonl`
- recording lifecycle and process metadata
- recording LogTape structured logs when enabled
- preserving process relationships and invocation tracing

Initial child process capture policy:

- child processes do not create their own top-level `{run_id}_{name}` log directories
- child stdout and stderr are captured into the root invocation's `stdout.log` and `stderr.log`
- structured child lifecycle information is recorded in the root invocation's `events.jsonl`

Per-child dedicated text log files are an optional future enhancement, not a required base behavior.

### 36.10 Console mirroring and clean stdout

Console mirroring behavior is configurable through `logging.stdout` and `logging.stderr`.

Expected default model:

- stdout may be mirrored to console and captured to file
- stderr may be mirrored to console and captured to file
- `events.jsonl` is not mirrored to console by default

Important exception:

- commands like `shellenv` that emit machine-readable shell code must preserve a clean stdout contract
- diagnostics, warnings, and logging for such commands must go to stderr or structured events, not to stdout

### 36.11 Structured event model

`events.jsonl` is the canonical structured event stream.

Recommended minimum fields per event:

- `ts`
- `level`
- `msg`
- `category`
- `run_id`
- `root_run_id`
- `source`
- `event_type`

Recommended additional fields when relevant:

- `parent_run_id`
- `name`
- `type`
- `cwd`
- `argv`
- `pid`
- `exit_code`
- arbitrary structured context fields

Recommended `source` values include:

- `alteran`
- `logtape`
- `process_capture`
- `user_app`

Recommended `event_type` values include:

- `log`
- `lifecycle`
- `process_started`
- `process_exited`
- `stdout_chunk`
- `stderr_chunk`
- `spawn`
- `config_loaded`

---

---

## 37. LogTape Integration, Import Mapping, and Categories

LogTape integration is optional and controlled by `logging.logtape`.

### 37.1 No LogTape by default

If `logging.logtape` is absent or false:

- LogTape is not required as an Alteran feature dependency
- the LogTape bootstrap layer remains inactive
- LogTape should not be downloaded only because Alteran exists

### 37.2 Default LogTape bootstrap

If `logging.logtape` is `true`:

- Alteran enables LogTape with default configuration
- Alteran-managed `run` and `task` execution bootstrap LogTape automatically
- the bootstrap reads the effective `logging.logtape` setting from the current project's `alteran.json`
- structured LogTape records are written into the root invocation's `events.jsonl`
- any configured text-oriented sinks may also emit to stdout/stderr depending on the effective config

If `logging.logtape` is an object:

- Alteran default LogTape config is deep-merged with it
- user overrides take precedence
- user may explicitly reset config using native LogTape reset behavior if needed
- the object is read from the current project's `alteran.json`, not propagated as a heavyweight environment variable

### 37.3 Bootstrap and extension files

Alteran should provide bootstrap and extension files under:

```text
.runtime/alteran/logging/
```

Planned files:

- `logtape_cfg_mock.ts`
- `logtape_ext.ts`

`logtape_cfg_mock.ts` is the Alteran-side LogTape bootstrap/configuration entrypoint. It performs initial LogTape configure when LogTape is enabled and re-exports the original `@logtape/logtape` API.

`logtape_ext.ts` provides explicit optional helpers and extensions beyond plain LogTape and should be exposed through:

```text
@alteran/logging/logtape_ext
```

This separation is intentional:

- the `@logtape/logtape` proxy is for infrastructure bootstrap
- `@alteran/logging/logtape_ext` is for explicit Alteran extensions

### 37.4 Import mapping strategy

Alteran may remap only the bare LogTape specifier:

```json
{
  "imports": {
    "@logtape/logtape": "./.runtime/alteran/logging/logtape_cfg_mock.ts"
  }
}
```

This remapping is used only for Alteran-managed Deno execution inside the project.

Important rules:

- only the bare `@logtape/logtape` specifier is remapped
- subpath imports such as `@logtape/logtape/...` continue to resolve to the original package unless explicitly remapped
- the proxy module performs bootstrap and then re-exports native LogTape API

Even if the proxy module exists, it should remain inert when `logging.logtape` is disabled. In that case it should effectively behave as a plain re-export without Alteran-side configure.

### 37.5 Top-level `await` in the proxy module

The LogTape proxy/config bootstrap may use top-level `await` when running in Alteran-managed Deno execution.

This is acceptable because:

- execution is controlled by Alteran
- the environment is Deno-only
- there is no target requirement for browser compatibility
- Node.js compatibility, if present at all, is limited to a thin bootstrap bridge in the top-level proxy entrypoint rather than the Alteran runtime itself

### 37.6 Category model for Alteran

Alteran should use hierarchical LogTape categories.

Example category families:

- `["alteran"]`
- `["alteran", "runtime"]`
- `["alteran", "runtime", "preinit"]`
- `["alteran", "app"]`
- `["alteran", "tool"]`
- `["alteran", "task"]`
- `["alteran", "run"]`
- `["alteran", "deno"]`
- `["alteran", "config"]`

Application/user-specific categories may extend further:

- `["alteran", "task", "build", "module"]`
- `["alteran", "app", "server", "http"]`

Recommended principle:

- categories represent architectural/logical path segments
- configuration applies by hierarchical prefix
- sinks and levels are inherited down the category tree

### 37.7 Alteran LogTape extensions

Alteran should provide convenience extensions in `logtape_ext.ts`.

Planned helpers:

- `getChildWith(category, context)`
- `withCategoryAndContext(category, context, fn)`

`getChildWith(...)` is syntax sugar that combines child category selection and context attachment in one helper.

`withCategoryAndContext([...], {...}, () => { ... })` is a scoped helper useful for subroutines, nested tasks, and structured execution blocks.

Alteran may add `getChildWith(...)` through an interface declaration plus prototype extension for the logger type, but such additions should remain inside Alteran's explicit extension module and should not be silently injected into the standard LogTape API import unless intentionally desired.

### 37.8 Retention and cleanup

Logs are expected to grow over time.

Cleanup is already conceptually supported through `clean`, including `clean logs`.

Additional retention behavior should be configurable through logging-related settings, especially under `logging.stdout`, `logging.stderr`, `logging.logtape`, or related logging configuration fields.

Potential controls may include:

- max retained runs
- max total size
- max age
- per-stream size limits

These policies should remain configurable rather than hard-coded.
