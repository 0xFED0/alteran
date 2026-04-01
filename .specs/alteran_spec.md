# Alteran Specification (Unified Project, Runtime, and Publication Spec)

## 1. Purpose

**Alteran** is a lightweight project-local runtime and scaffold manager for
Deno-based automation projects.

Its goals are:

- keep Deno local to the project when desired
- avoid requiring global Deno installation
- provide reproducible project-local cache/runtime layout
- manage multiple apps and tools inside one dev project
- support simple bootstrap from an empty folder
- prepare for future optional GUI/view support without making it central yet

Alteran is **not** currently a desktop framework, IPC framework, or native host
platform.

At this stage, `view` is only a placeholder/future extension point.

---

## 2. Core Design Principles

- **Deno is the runtime**
- Alteran is a **project-local bootstrap + manager**
- Runtime files live under **`.runtime/`**
- Alteran exposes a **stable public entrypoint** while keeping its canonical
  runtime implementation inside the local project runtime
- The system supports:
  - local dev environment
  - standalone app folders
  - future bundling/build flows
- root project structure includes first-class **`apps/`**, **`tools/`**,
  **`libs/`**, and **`tests/`**
- `view` is optional and not yet fully specified
- no special IPC protocol is required at this stage
- bootstrap shell scripts should stay minimal
- most logic should live in TypeScript, not shell

---

## 3. Main User Flows

### 3.1 Bootstrap an empty project

A user should be able to place or download:

- `activate`
- `activate.bat`

into an empty folder and run them.

These scripts bootstrap the project-local runtime and project skeleton.

### 3.2 Enter dev environment

A user can activate the local environment so `deno` and `alteran` work without
global installation.

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

They should resemble each other where practical, while preserving a clear
distinction between repository-only concerns and normal managed project
concerns.

### 4.1 Alteran source repository layout

The Alteran source repository should be organized similarly to a real
Alteran-managed project, with additional repository-oriented directories.

Suggested repository layout:

```text
repo/
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

Unix bootstrap/activation entry for repository development.

##### `activate.bat`

Windows bootstrap/activation entry for repository development.

##### `alteran.ts`

Public repository-level bootstrap/proxy entrypoint.

It delegates to:

```text
src/alteran/mod.ts
```

This file exists to provide a stable public entrypoint for repository use,
bootstrap use, and publication preparation.

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
- `src/tools/` — authored runtime-helper tools that may be materialized into
  `.runtime/tools/`
- `src/libs/` — authored runtime-helper libraries that may be materialized into
  `.runtime/libs/`

##### `src/alteran/templates/`

Alteran-owned templates and generator modules for regenerable files such as:

- `activate`
- `activate.bat`
- `.runtime/env/enter-env.sh`
- `.runtime/env/enter-env.bat`
- future generated config/bootstrap files

Bootstrap templates such as `activate` / `activate.bat` should be kept as
embedded string-based source-of-truth in Alteran-owned TypeScript modules such
as:

- `src/alteran/templates/bootstrap.ts`

rather than as neighboring shell-template files that must be read from disk at
runtime.

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

That versioned directory contains the exact package contents that will be
published to JSR.

##### `dist/zips/`

Controlled archive/release output directory.

Each prepared archive release should live under a versioned subdirectory:

```text
dist/zips/<version>/
```

This may contain zip assets prepared from the corresponding versioned
`dist/jsr/<version>/` bundle for GitHub Releases or similar distribution flows.

##### `.runtime/`

Materialized/generated runtime for the repository itself.

In the Alteran source repository, `.runtime/` is not the authored source of
truth. It should be reproducible from `src/` and should be ignored by Git.

### 4.2 Alteran-managed project layout

A normal Alteran-managed user project should be organized like this:

```text
project/
  activate
  activate.bat
  alteran.json
  deno.json
  deno.lock
  apps/
  tools/
  libs/
  tests/
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

- `activate`
- `activate.bat`

The project root should not require a public `alteran.ts` file.

That bootstrap/proxy file exists in the Alteran source repository and
publication package, not as a required long-term public file in every managed
project root.

### 4.4 `.gitignore` contract

Both the Alteran source repository and Alteran-managed user projects should
include a root `.gitignore`.

#### Repository `.gitignore`

The Alteran source repository should ignore generated and machine-local
artifacts while keeping authored source code tracked.

At minimum it should ignore things such as:

- the repository-local `.runtime/` tree in full
- generated publication output under `dist/jsr/` and `dist/zips/`
- nested standalone app-local `.runtime/` directories

It should continue tracking authored runtime source such as:

- `src/alteran/`
- `src/tools/`
- `src/libs/`

#### Managed project `.gitignore`

`alteran init` should create a project-root `.gitignore` for normal
Alteran-managed projects.

That project-level `.gitignore` should ignore generated/recoverable local state
such as:

- `.runtime/`
- nested app-local `.runtime/`
- reproducible build output such as `dist/`

The intent is:

- track user source and config
- ignore local runtime/cache/build artifacts
- make a newly initialized project ready for Git without requiring manual
  cleanup

---

## 5. `.runtime` Layout

```text
.runtime/
  alteran/
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
  env/
    enter-env.sh
    enter-env.bat
```

### 5.1 `.runtime/alteran/`

This directory contains Alteran's own runtime code and infrastructure.

It is the canonical home of the Alteran system inside a project runtime.

Expected contents include:

- `mod.ts` — main internal Alteran runtime entrypoint
- `preinit.ts` — managed-process preload entrypoint for other scripts (this is
  prerun hook)
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

Examples may include helper tools used by the runtime, bootstrap flow, or future
view-related work such as `lantea.ts`.

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

### 5.6 Why cache is platform-specific

`.runtime/deno/{os}-{arch}/cache` avoids cross-platform cache collisions and
keeps runtime artifacts safe and predictable.

### 5.7 `.runtime/env/`

Stores generated environment activation scripts.

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

Alteran and `activate` should treat this as a source-of-truth location from
which `.runtime/alteran`, `.runtime/tools`, and `.runtime/libs` may be
materialized.

The Alteran source repository may place this in a root `.env` file, for example:

```text
ALTERAN_SRC=./src
```

Alteran should load `.env` as an actual environment file for repository/project
commands rather than treating it as a one-off source hint.

### 6.2 Download source lists

Alteran should support configurable source lists for both Deno and Alteran
itself.

Environment variables:

- **`DENO_SOURCES`**
- **`ALTERAN_RUN_SOURCES`**
- **`ALTERAN_ARCHIVE_SOURCES`**

Backward compatibility:

- **`ALTERAN_SOURCES`** may be supported as a legacy alias for
  `ALTERAN_RUN_SOURCES`

These act as ordered fallback lists.

Rules:

- if the variable is **unset**, Alteran may use its built-in default source list
- if the variable is **set**, Alteran must use the provided list as-is
- if the provided list is empty, Alteran must fail with an explicit message
  telling the user that the list is empty and can be configured via the
  corresponding environment variable
- when download/bootstrap from one source fails, Alteran must continue to the
  next source
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

`ALTERAN_RUN_SOURCES` is intended for Alteran bootstrap/runtime sources that can
be invoked directly through Deno.

Each item should be treated as a Deno-compatible runnable specifier, for
example:

- a JSR package specifier when Alteran is published in a Deno-compatible package
  form
- an HTTPS URL to a runnable Alteran entrypoint
- another Deno-supported module specifier

This is intentional.

Alteran bootstrap should prefer invoking Alteran sources through Deno directly,
rather than forcing all sources to be raw downloaded files.

Reason:

- it preserves support for `jsr:@alteran`
- it keeps Deno-native specifier support
- it allows mirrors to be either package-oriented or URL-oriented
- it avoids locking the design to raw-file-only distribution

Until a public Alteran package/source is actually available, the built-in
default for `ALTERAN_RUN_SOURCES` may legitimately be empty, in which case
bootstrap/update flows must emit the explicit empty-list error described above.

#### `ALTERAN_ARCHIVE_SOURCES`

`ALTERAN_ARCHIVE_SOURCES` is intended for downloadable archive bundles such as
GitHub Release zip assets.

Each item is expected to be a direct archive URL.

Alteran should:

- download the archive into a temporary location
- extract it locally
- locate a bootstrapable Alteran entry such as `alteran.ts` with adjacent
  `src/alteran/mod.ts`
- invoke that local extracted entry through Deno

This allows publication artifacts prepared from `dist/jsr/<version>/` to be
reused as bootstrapable archive releases.

---

## 7. Activate Scripts

### 7.1 Responsibility of `activate` / `activate.bat`

These scripts should remain minimal bootstrap wrappers.

They are responsible for:

1. resolving the location of the `activate` script itself
2. resolving the target project directory:
   - if an explicit path argument is provided, use it
   - otherwise use the directory containing the `activate` script
3. determining current OS/arch
4. checking whether project-local Deno exists
5. falling back to global Deno if present
6. downloading local Deno into `.runtime/deno/{os}-{arch}/bin/` if needed
7. checking whether the local Alteran runtime entry exists at
   `.runtime/alteran/mod.ts`
8. obtaining the Alteran runtime material either:
   - from local Alteran repository source material such as `src/alteran/`,
     `src/tools/`, and `src/libs/`, if available
   - or from remote bootstrap/publication sources as fallback
9. invoking Alteran initialization for the target directory
10. activating the environment:
    - on Unix-like systems: evaluate `shellenv`
    - on Windows: call generated batch env script

Bootstrap scripts must not implement project scaffolding or project
synchronization logic themselves.

They only bootstrap enough to run Alteran, then delegate project management to
Alteran commands.

#### Source-list behavior during bootstrap

When `activate` / `activate.bat` need to download Deno or obtain Alteran from
remote sources, they must:

- read `DENO_SOURCES`
- read `ALTERAN_RUN_SOURCES`, with optional legacy `ALTERAN_SOURCES` aliasing
- read `ALTERAN_ARCHIVE_SOURCES`
- try runnable Alteran sources first
- try archive Alteran sources only after runnable sources fail
- iterate over the configured sources in order
- stop on first successful source
- continue to the next source after a failed attempt
- fail with a clear summary if all configured sources fail
- fail immediately with an explicit message if the relevant configured list is
  empty

### 7.2 Stable bootstrap entry

The public bootstrap/proxy entry remains `alteran.ts` in the Alteran repository
and publication package.

In the source repository and publication package, that stable entry may delegate
into:

```text
src/alteran/mod.ts
```

In a materialized Alteran-managed project, the effective runtime entry remains:

```text
.runtime/alteran/mod.ts
```

This keeps bootstrap/public usage stable while the materialized project-local
runtime remains self-contained under `.runtime/alteran/`.

---

## 8. `alteran.ts` and Internal Runtime Entry

`alteran.ts` is the stable public Alteran entrypoint.

It is responsible for exposing the main Alteran command surface while delegating
into the canonical project-local runtime entry.

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

This proxy exists in the Alteran source repository and in the publication
package.

In those contexts it delegates into the authored source tree, which can then
materialize `.runtime/alteran/` for normal projects.

### 8.2 Why this split exists

This split keeps the public entry stable while allowing the authored source tree
to live under `src/alteran/` while normal managed projects continue to use the
materialized `.runtime/alteran/` layout.

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

Alteran runtime files are downloaded or materialized during bootstrap and stored
locally.

They should **not** be executed from a remote URL on every run.

Using a URL is acceptable only during bootstrap, update, or controlled
publication/bootstrap flows.

This includes source-list driven acquisition through `DENO_SOURCES`,
`ALTERAN_RUN_SOURCES`, and `ALTERAN_ARCHIVE_SOURCES`.

### 8.5 Command scope model

Alteran commands are divided into two groups.

#### External-project commands

These may operate on a project directory even when that project is not currently
activated:

- `init <dir>`
- `shellenv [dir]`

#### Active-project commands

These operate on the currently activated project and should resolve the project
through `ALTERAN_HOME`:

- `refresh`
- `app ...`
- `tool ...`
- `reimport ...`

This keeps project-management commands tied to the active dev environment, while
still allowing bootstrap/init flows to target projects from outside.

---

## 9. Environment Activation

The `init` / `refresh` flow must generate:

- `.runtime/env/enter-env.sh`
- `.runtime/env/enter-env.bat`

These scripts are responsible for setting up the dev environment.

### 9.1 Responsibilities of enter-env scripts

They should:

- set `ALTERAN_HOME`
- add local Deno to `PATH`
- add Alteran command alias/shim to `PATH` or shell alias scope
- configure project-local cache paths
- expose a convenient `alteran` command

### 9.2 Alias model

Aliases may be implemented through shell alias / DOSKEY-like environment setup
rather than generating many executable wrapper files.

This is preferred for dev shells.

### 9.3 `shellenv`

`shellenv` prints environment activation code for the target project.

It should:

- print shell code to stdout
- print logs/diagnostics only to stderr
- reuse existing generated env scripts when possible
- if no env script exists, generate activation output in memory and print it to
  stdout without persisting a new file

`shellenv` is intended for interactive activation flows such as:

- Unix: `eval "$(deno ... alteran.ts shellenv)"`
- Windows: generation/use of batch env script, then `call` it

### 9.4 Activation model

#### Unix-like systems

Preferred activation flow:

1. bootstrap runtime
2. run `alteran.ts init <target-dir>`
3. evaluate `alteran.ts shellenv <target-dir>`

This requires the rule for shellenv:

- stdout = shell activation code only
- stderr = logs, warnings, diagnostics

#### Windows

Preferred activation flow:

1. bootstrap runtime
2. run `alteran.ts init <target-dir>`
3. ensure `.runtime/env/enter-env.bat` exists
4. `call` that file

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

`alteran.json` is Alteran's own project config. Can be in JSONC format (with
comments). Note: if you want to modify jsonc file, please use
non-fmt-destructive approach with jsonc-parser edits-modify methods to persist
user comment, instead of full clean regeneration file.

It should not be mixed into `deno.json`.

### 11.1 Responsibilities

It stores:

- app registry
- tool registry
- auto-reimport config
- alias and shortcut config
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

Exact schema may evolve, but these concepts must exist. Later sections refine
the runtime and logging parts of this file in more detail.

---

## 12. Root `deno.json`

The root `deno.json` configures the whole dev project. Can be in JSONC format
(with comments). Note: if you want to modify jsonc file, please use
non-fmt-destructive approach with jsonc-parser edits-modify methods to persist
user comment, instead of full clean regeneration file.

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

Alteran should maintain these entries when apps are registered, removed, or
refreshed.

### 12.2 Import support

The root `deno.json` is also the natural place for Alteran-managed import
configuration used by the active project.

In particular, Alteran should maintain the import surface required for:

- `@alteran`
- `@alteran/...`
- `@libs/...`

The exact mechanics may evolve, but the logical import surface defined by this
specification must remain stable.

---

## 13. Project Import Mapping, Libraries, and Tests

Alteran-managed projects should expose a stable internal import surface for both
Alteran runtime modules and project libraries.

### 13.1 Alteran runtime imports

Inside an Alteran-managed development project, the following logical import
mapping should be used:

- `@alteran` -> `.runtime/alteran/mod.ts`
- `@alteran/...` -> `.runtime/alteran/*`

This gives project code a stable internal import surface for Alteran runtime
modules and avoids exposing random relative paths into `.runtime/`.

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

They are shared code modules, and requiring a manifest for each library would
add unnecessary ceremony.

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

When code is executed in app context, the `@libs/...` alias resolves in this
order:

1. app-local `apps/<app>/libs/...`
2. project-root `libs/...`

This is intentional.

### 13.7 Shadowing behavior

If both locations provide the same library name, the app-local version shadows
the project-root version.

This is valid behavior.

It is not treated as an automatic error.

If a project wants to detect or forbid shadowing, that should be handled by
linting, static checks, or a dedicated deduplication tool.

### 13.8 Why a separate `@app-libs/...` alias is not used

A separate alias such as `@app-libs/...` was considered and rejected because it
causes unnecessary instability:

- moving a library between app-local and project-root locations would force
  import rewrites
- exported apps would have awkward import behavior after dependency copying
- the import path would reflect current physical placement instead of stable
  logical identity

Using a single `@libs/...` alias with local-first resolution avoids those
problems.

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

- detect whether parent runtime exists through `ALTERAN_HOME`
- use parent runtime when available
- otherwise create/use app-local `.runtime` for standalone mode

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

It is **not** the canonical storage model for the Alteran runtime itself, which
lives under `.runtime/alteran/`.

### 15.2 Tool library policy

Tools do not need a dedicated tool-local library namespace by default.

Reason:

- the `tools/` area already acts as a natural location for tool code
- if shared code becomes broadly useful, it can be moved into root `libs/`
- introducing a separate tool-local alias family by default would add complexity
  without enough payoff

---

## 16. App Runtime Rules

### 16.1 Default behavior inside dev project

Apps should use the parent project `.runtime`.

### 16.2 Standalone behavior

If an app is exported or initialized outside the dev project, `app` / `app.bat`
may create app-local `.runtime`.

That app-local runtime should contain only what is needed, primarily:

- local Deno if no global Deno
- local cache if needed
- Alteran runtime material needed to launch the app

### 16.3 Export and packaging rules for libraries

When an app is exported as a source package or standalone application seed, any
shared libraries it depends on must be included in the exported package.

This applies to:

- app-local libraries
- project-root libraries referenced through `@libs/...`

### 16.4 Packaging behavior

If an exported app depends on project-root `libs/...`, those required libraries
should be copied into the exported package so the exported app remains
self-contained.

The exported package may place them into its own `libs/` directory.

This works naturally with the single `@libs/...` alias model.

Because the alias remains the same, no code rewrite is required purely because a
library moved from shared-project scope into packaged-app scope.

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

Runs the application in orchestrated mode, deciding whether to launch `core`,
`view`, or both depending on parameters and future app configuration.

---

## 18. Main Commands

Alteran command structure should be explicit.

Preferred pattern:

- `alteran app run MyApp`
- `alteran tool run MyTool`
- `alteran test`

Do **not** collapse `run` into positional magic.

This section establishes the main command-family shape. Later sections refine
convenience aliases, Deno passthrough, and version-management commands without
changing this core rule.

### 18.1 Command help contract

Alteran should provide built-in help for:

- top-level `alteran --help`
- `alteran help`
- each command family such as `alteran app --help`, `alteran tool --help`,
  `alteran clean --help`

Command-family help should describe:

- supported subcommands
- accepted argument forms
- important variations or examples

If a command normally requires an argument, passing `--help`/`-h` must show help
instead of treating that flag as ordinary data.

---

## 19. App Commands

Supported commands:

- `alteran app add <name>`
- `alteran app rm <name>`
- `alteran app purge <name>`
- `alteran app ls`
- `alteran app run <name>`
- `alteran app init <path>`

### 19.1 `app add`

Responsibilities:

- register app in `alteran.json`
- update root `deno.json` workspace/tasks as needed
- create app scaffold if the folder does not yet exist

### 19.2 `app rm`

Responsibilities:

- unregister app from Alteran registry
- remove related workspace/task/alias entries
- **must not** delete app files from disk

### 19.3 `app purge`

Responsibilities:

- destructively remove app directory/files
- remove from registry/config as well

### 19.4 `app ls`

List registered/discovered apps.

### 19.5 `app run`

Run a registered app.

### 19.6 `app init <path>`

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

---

## 21. Reimport Commands

Supported commands:

- `alteran reimport apps <dir>`
- `alteran reimport tools <dir>`

These commands scan directories and import discovered apps/tools into
Alteran-managed config.

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

This command is responsible for bringing the **currently activated project**
into a consistent state.

### 23.1 Scope

`refresh` should operate only on the active project resolved through
`ALTERAN_HOME`.

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
- synchronize the effective local Deno runtime with `alteran.json`
  configuration, especially `deno_version` if present
- when runtime acquisition/download is needed, use `DENO_SOURCES`,
  `ALTERAN_RUN_SOURCES`, and `ALTERAN_ARCHIVE_SOURCES` fallback behavior,
  preferring runnable sources before archive sources

`refresh` is a synchronization command. It should bring the current project into
compliance with declared configuration, but it should not silently choose new
target versions on its own.

### 23.3 Run without arguments

`alteran` without arguments should **not** automatically perform refresh.

Better behavior:

- show help/status/summary

### 23.4 Optional automatic refresh before run

`alteran.json` may contain:

- `auto_refresh_before_run: true|false`

If enabled, Alteran refreshes before executing a requested command.

### 23.5 Init Command

Project initialization command:

- **`alteran init [dir]`**

This command is responsible for preparing a project directory so that it becomes
a valid Alteran project.

#### Responsibilities of `init`

- create missing base project files if needed
- create missing directory skeleton if needed
- ensure `.runtime/` exists
- ensure local runtime/tooling is available
- create or repair `alteran.json`
- create or repair `deno.json`
- create or repair `.gitignore`
- create or repair env scripts
- perform a `refresh` as part of initialization

When `init` needs to obtain Deno or Alteran runtime material, it should honor
the configured source-list behavior from Section 6.1.

#### Scope

`init` may target:

- the current working directory
- an explicit external project directory

This makes it suitable for bootstrap flows and for initializing projects outside
the currently active shell context.

---

## 24. Generated Shortcuts and Deno Tasks

Alteran should support app/tool registration into:

- Deno tasks
- shell aliases / DOSKEY aliases

This section covers generated shortcuts tied to registered apps and tools.
Global convenience aliases such as `alt`, `arun`, `atask`, `ax`, and `adeno` are
specified later with the broader command surface.

### 24.1 Deno tasks

Useful for:

- discoverability
- reproducible entrypoints
- dev convenience

### 24.2 Shell shortcuts

Useful inside activated shell sessions.

These do not need to be files in `bin/`. They may be emitted into generated
environment scripts.

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

Entry scripts should import from sibling directories relatively, rather than
downloading submodules dynamically on every run.

Bootstrap/update should fetch both the entry script and its support folder when
this pattern is used.

---

## 26. Clean Command

Alteran should support an explicit cleanup command:

- **`alteran clean <scope> [<scope> ...]`**

This command removes generated, downloaded, cached, or otherwise recoverable
files.

It must never silently remove user source files or user configuration files.

### 26.1 No implicit default scope

`alteran clean` without a scope should **not** perform any cleanup.

It should instead:

- show help
- show available cleanup scopes
- require the user to explicitly choose what to clean

This keeps cleanup behavior predictable and safe.

When scopes are provided, Alteran should accept one or more scopes in a single
invocation and execute them in the order given.

Examples:

- `alteran clean env`
- `alteran clean env logs`
- `alteran clean cache builds`

### 26.2 Supported cleanup scopes

#### `alteran clean all`

Performs a full safe cleanup.

It should remove everything that can be recreated through:

- `activate`
- `init`
- `refresh`

It should preserve:

- `activate`
- `activate.bat`
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

This scope is intended to leave a clean project suitable for sending as a zip
archive, while preserving all user-owned sources and configuration.

#### `alteran clean cache`

Removes Deno cache contents.

By default, it should clean only the cache for the **current platform**:

```text
.runtime/deno/{os}-{arch}/cache
```

Optional future flag:

- `--all-platforms`

#### `alteran clean runtime`

Removes generated and downloaded runtime contents under `.runtime/`, except
where Alteran explicitly decides to preserve the minimum bootstrap state.

This is broader than `cache` and may include:

- platform-local runtime binaries
- generated env files
- downloaded Alteran runtime material
- generated runtime metadata

This scope should still preserve user-owned project files outside `.runtime/`.

It should also preserve authored runtime source that lives inside `.runtime/`,
including directories such as:

- `.runtime/alteran/`
- `.runtime/tools/`
- `.runtime/libs/`

Because `.runtime/` is Alteran-managed internal space, `alteran clean runtime`
may also remove unexpected top-level entries under `.runtime/` that are not part
of the expected Alteran runtime layout. This includes stale legacy directories
left behind by previous layout versions.

When `alteran clean runtime` is invoked from an active Alteran shell session
that is currently using the project-local Deno binary, it should preserve that
active local `bin/deno[.exe]` so subsequent commands such as `alteran refresh`
continue to work without requiring immediate re-activation or re-download.

#### `alteran clean env`

Removes generated environment activation files under:

```text
.runtime/env/
```

Examples:

- `enter-env.sh`
- `enter-env.bat`

These files must be recreatable through `init` / `refresh`.

#### `alteran clean app-runtimes`

Removes nested app-local `.runtime/` directories used by standalone apps.

This scope is intended for app folders that were initialized or exported outside
the main dev runtime and later accumulated their own runtime state.

#### `alteran clean logs`

Removes log files and log-derived artifacts under `.runtime/logs/` according to
the logging layout specified later in this document.

It must not remove source files or project configuration.

#### `alteran clean builds`

Reserved for future build/output cleanup.

This scope should remove generated build outputs such as:

- transpiled web assets
- bundled output
- generated distribution artifacts
- other reproducible build products

It must not remove source files.

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

They are not required for the first implementation, but the command design
should leave room for them.

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

Unversioned top-level payload files directly under `dist/jsr/` are legacy layout
artifacts and should not be left behind by current publication tooling.

The version string should come from Alteran's authored version source under
`src/alteran/`.

Zip/release artifacts may additionally be prepared under:

```text
dist/zips/<version>/
```

### 29.2 Why publish from `dist/jsr/<version>/`

This model is preferred because it:

- makes publication contents explicit
- prevents accidental publication of unrelated repository files
- allows validation that the package contains exactly what `init` needs
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
- validating package completeness
- running dry-run publication checks
- publishing the final package

### 29.4 Public JSR package goal

The intended public command is:

```bash
deno run -A jsr:@alteran init
```

Therefore the Alteran package should publish a root entrypoint for the package
itself, not only a subpath CLI module.

### 29.5 Package naming

The target package identity is:

```text
@alteran
```

### 29.6 Public package entry vs programmatic API

`@alteran` is primarily a CLI-oriented package.

Its main responsibility is to serve commands such as:

```bash
deno run -A jsr:@alteran init
```

If Alteran exposes programmatic APIs such as:

```ts
import { init } from "@alteran/lib";
await init(dir);
```

those should live under a library-oriented subpath such as:

```text
@alteran/lib
```

This keeps the split clear:

- `@alteran` -> CLI/bootstrap entry
- `@alteran/lib` -> programmatic API

### 29.7 Publication package contents

The published JSR package should contain everything needed for the public
bootstrap/init flow.

In particular, it must contain enough Alteran runtime material so that:

- the public package entry can run `init`
- `init` can copy or materialize the required runtime files into the target
  project's `.runtime/`
- the resulting initialized project can operate correctly from its local runtime

In practice, the publication package may ship the authored source bundle under
`src/` and use that as the source-of-truth from which the target project's
`.runtime/` is materialized.

This means the publication package is not just a thin remote stub.

It is the seed from which project-local Alteran runtime state can be created.

### 29.8 Documentation expectations

The generated `dist/jsr/<version>/` package should include explicit package
metadata such as:

- package name
- version
- exports
- publication configuration

This may be expressed through `jsr.json` or equivalent supported package
metadata.

Repository code intended for publication should use JSDoc appropriately so JSR
can generate useful package documentation.

The repository should also maintain:

- `README.md`
- `docs/`

so the public package and project remain understandable.

---

## 30. Minimal Bootstrap Contract

A minimal bootstrap flow from an empty folder should be possible with:

```bash
curl <bootstrap-url> | sh
```

or equivalent downloaded `activate` script.

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
5. a command router with a stable public entrypoint `alteran.ts` delegating to
   `.runtime/alteran/mod.ts`
6. a local runtime layout under `.runtime/`
7. an explicit command surface with app/tool families, Deno passthrough, and
   version-management commands
8. a project structure with first-class `apps/`, `tools/`, `libs/`, and `tests/`
9. a logging system with stdout/stderr capture plus structured event logs
10. a controlled JSR publication model rooted at `dist/jsr/<version>/`, with
    optional archive artifacts under `dist/zips/<version>/`
11. a future-ready system with reserved `view` hooks, but without committing to
    GUI architecture yet

---

## 33. Managed Preinit and Deno Execution

Alteran-managed script execution should support a preload-based process
initialization model.

### 33.1 Preinit entrypoint

A dedicated preload module must exist:

```text
.runtime/alteran/preinit.ts
```

This module is intended to be passed through Deno's preload mechanism when
Alteran runs scripts and tasks in its managed environment.

### 33.2 Purpose of `preinit.ts`

`preinit.ts` is responsible for process-local Alteran initialization before the
target user script executes.

Examples of responsibilities:

- initialize Alteran runtime context
- expose runtime metadata and helpers
- configure logging hooks or runtime integrations
- load Alteran-aware environment state
- prepare process-level helper APIs needed by managed scripts

This preinit hook is also the natural place for Alteran-managed logging
bootstrap, especially when structured logging integrations are enabled.

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
- `alteran run` and `alteran task` run inside Alteran-managed process
  initialization

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

This is useful when the user wants raw Deno behavior, but with Alteran runtime
resolution and environment variables already applied.

Examples:

- `alteran deno run ...`
- `alteran deno task ...`
- `alteran deno test ...`
- `alteran deno upgrade --version=...`

Alias:

- `adeno`

`alteran deno` should be treated primarily as a passthrough/proxy namespace, not
as a large Alteran-specific command family.

### 34.5.1 `alteran test`

Alteran should provide:

- **`alteran test`**

This is a convenience shortcut for:

```text
alteran deno test ...
```

It should behave like `deno test`, but executed inside the Alteran-managed
environment.

Examples:

- `alteran test`
- `alteran test tests/foo_test.ts`
- `alteran test --filter my_case`

### 34.6 `alteran x`

`alteran x` is equivalent in spirit to `deno x`, but executed inside the Alteran
environment.

Alias:

- `ax`

---

## 35. Update, Upgrade, Use, and Deno Version Management

Alteran should clearly separate project dependency update, tooling upgrade,
configuration mutation, and configuration synchronization.

### 35.1 `alteran update`

Alteran should provide:

- **`alteran update`**

This command is conceptually equivalent to running Deno dependency updates for
the current project.

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

This command is for upgrading installed tooling, not for editing project
configuration.

When `upgrade` needs to download Alteran or Deno, it should honor the
source-list behavior from Section 6.1.

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
- if no version is specified for a selected target, Alteran should use the
  latest appropriate version for that target

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
- either apply it immediately or instruct the user to run `alteran refresh`,
  depending on the final implementation choice

This is the preferred place for project config mutation related to Deno version
selection.

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
- omitted, in which case Alteran is free to use its default bootstrap/runtime
  policy

### 35.7 Runtime resolution rule

When Alteran needs Deno, it should:

1. check project-local Deno in `.runtime/deno/{os}-{arch}/bin/`
2. if global or parent Deno is available and satisfies the configured version
   constraint, it may be used during bootstrap/init flows
3. if no available Deno satisfies the configured version requirement, Alteran
   downloads an appropriate local Deno into the project runtime
4. once local runtime is established, project execution should prefer the local
   Deno

### 35.8 `alteran refresh`

`refresh` is the synchronization command for project state and runtime state.

Behavior:

- if `alteran.json` contains `deno_version`, bring local Deno into compliance
  with that configured specifier
- if no `deno_version` is configured, follow Alteran's default bootstrap/runtime
  policy without mutating config

`refresh` should not silently choose new target versions on its own.

### 35.9 `alteran upgrade --deno[=...]`

Alteran should support upgrading the Alteran-managed Deno runtime through the
top-level command.

Supported forms:

```text
alteran upgrade --deno
alteran upgrade --deno=<version-spec>
```

Behavior:

- this is a convenience wrapper over `alteran deno upgrade`
- `alteran upgrade --deno=<version-spec>` should map conceptually to
  `alteran deno upgrade --version=<version-spec>`
- `alteran upgrade --deno` should map conceptually to `alteran deno upgrade`

This command upgrades the installed Alteran-managed Deno runtime.

It should **not** rewrite `alteran.json` by default.

If the installed/runtime Deno and configured `deno_version` diverge, Alteran may
emit a warning, but config mutation should remain an explicit action via
`alteran use --deno=...`.

### 35.10 `alteran deno upgrade`

Supported form:

```text
alteran deno upgrade [--version=<version-spec>]
```

Behavior:

- acts as a passthrough/proxy invocation of Deno upgrade behavior within the
  Alteran environment
- preserves the underlying Deno upgrade semantics rather than reimplementing
  separate Alteran-specific logic
- applies to the Alteran-managed local runtime, not the global/system
  installation

### 35.11 `DENO_INSTALL_ROOT`

Alteran shell environment may need to set:

- **`DENO_INSTALL_ROOT`**

so that local Deno installation and upgrade flows place binaries into the
correct project-local runtime directory.

This is especially relevant for `alteran deno upgrade` and
`alteran upgrade --deno`.

### 35.12 Global Deno safety rule

Alteran must never modify the global/system Deno installation.

All Alteran-managed upgrades apply only to the project-local runtime.

---

## 36. Logging Model

Alteran should provide a logging system for CLI invocations, managed Deno
execution, structured events, runtime capture, and optional LogTape integration.

This logging model builds on the managed execution model from Section 33 and is
extended by the LogTape-specific integration rules in Section 37.

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

`stdout` and `stderr` are process stream captures. They are not structured
logging channels by themselves.

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

`logging.stdout` and `logging.stderr` control stream capture and console
mirroring behavior.

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
- the `@logtape/logtape` proxy remains inert and only re-exports the original
  package behavior

If set to `true`:

- LogTape is enabled
- Alteran applies its default LogTape configuration
- LogTape infrastructure is bootstrapped automatically in Alteran-managed
  execution

If set to an object:

- LogTape is enabled
- the object is treated as user LogTape configuration
- Alteran default configuration is deep-merged with the provided object
- if the user wants a full reset instead of merge, LogTape's own reset mechanism
  may be used

For `logging.logtape: { ... }`, Alteran default configuration is the base and
the user object is deep-merged over the defaults.

### 36.4 Log storage layout

Logs are stored under:

```text
.runtime/logs/
```

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

All logging for the invocation tree belongs to the root invocation directory
determined by the root call.

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

This layout provides chronological sorting, human-readable identification, and a
stable root directory for all logs of that invocation tree.

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

The intent of `metadata.json` is to describe the root invocation in a compact
form, allow quick debugging without parsing `events.jsonl`, and preserve
execution metadata even if logs are later rotated or partially truncated.

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

These identifiers should be available in structured events and, where useful,
via environment variables.

### 36.8 Environment variables for logging context

Alteran should propagate logging context into child processes through
environment variables.

Recommended variables:

- `ALTERAN_RUN_ID`
- `ALTERAN_ROOT_RUN_ID`
- `ALTERAN_PARENT_RUN_ID`
- `ALTERAN_ROOT_LOG_DIR`
- `ALTERAN_LOG_MODE`
- `ALTERAN_LOG_CONTEXT_JSON`

`ALTERAN_LOG_CONTEXT_JSON` should be a JSON string with a recommended shape
like:

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

This is preferred over comma-separated strings because it is less ambiguous,
easier to extend, avoids delimiter issues, and is future-proof for richer
metadata.

Recommended `ALTERAN_LOG_MODE` values are:

- `root`
- `child`
- `disabled`

### 36.9 Stream capture model

Alteran must distinguish between stream capture and structured events.

The capture layer is responsible for:

- capturing stdout and stderr from the root invocation tree
- appending captured output to `stdout.log` and `stderr.log`
- optionally mirroring those streams to the console according to
  `logging.stdout` / `logging.stderr`

The event layer is responsible for:

- writing structured events to `events.jsonl`
- recording lifecycle and process metadata
- recording LogTape structured logs when enabled
- preserving process relationships and invocation tracing

Initial child process capture policy:

- child processes do not create their own top-level `{run_id}_{name}` log
  directories
- child stdout and stderr are captured into the root invocation's `stdout.log`
  and `stderr.log`
- structured child lifecycle information is recorded in the root invocation's
  `events.jsonl`

Per-child dedicated text log files are an optional future enhancement, not a
required base behavior.

### 36.10 Console mirroring and clean stdout

Console mirroring behavior is configurable through `logging.stdout` and
`logging.stderr`.

Expected default model:

- stdout may be mirrored to console and captured to file
- stderr may be mirrored to console and captured to file
- `events.jsonl` is not mirrored to console by default

Important exception:

- commands like `shellenv` that emit machine-readable shell code must preserve a
  clean stdout contract
- diagnostics, warnings, and logging for such commands must go to stderr or
  structured events, not to stdout

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
- structured LogTape records are written into the root invocation's
  `events.jsonl`
- any configured text-oriented sinks may also emit to stdout/stderr depending on
  the effective config

If `logging.logtape` is an object:

- Alteran default LogTape config is deep-merged with it
- user overrides take precedence
- user may explicitly reset config using native LogTape reset behavior if needed

### 37.3 Bootstrap and extension files

Alteran should provide bootstrap and extension files under:

```text
.runtime/alteran/logging/
```

Planned files:

- `logtape_cfg_mock.ts`
- `logtape_ext.ts`

`logtape_cfg_mock.ts` is the Alteran-side LogTape bootstrap/configuration
entrypoint. It performs initial LogTape configure when LogTape is enabled and
re-exports the original `@logtape/logtape` API.

`logtape_ext.ts` provides explicit optional helpers and extensions beyond plain
LogTape and should be exposed through:

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

This remapping is used only for Alteran-managed Deno execution inside the
project.

Important rules:

- only the bare `@logtape/logtape` specifier is remapped
- subpath imports such as `@logtape/logtape/...` continue to resolve to the
  original package unless explicitly remapped
- the proxy module performs bootstrap and then re-exports native LogTape API

Even if the proxy module exists, it should remain inert when `logging.logtape`
is disabled. In that case it should effectively behave as a plain re-export
without Alteran-side configure.

### 37.5 Top-level `await` in the proxy module

The LogTape proxy/config bootstrap may use top-level `await` when running in
Alteran-managed Deno execution.

This is acceptable because:

- execution is controlled by Alteran
- the environment is Deno-only
- there is no target requirement for browser or Node.js compatibility

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

`getChildWith(...)` is syntax sugar that combines child category selection and
context attachment in one helper.

`withCategoryAndContext([...], {...}, () => { ... })` is a scoped helper useful
for subroutines, nested tasks, and structured execution blocks.

Alteran may add `getChildWith(...)` through an interface declaration plus
prototype extension for the logger type, but such additions should remain inside
Alteran's explicit extension module and should not be silently injected into the
standard LogTape API import unless intentionally desired.

### 37.8 Retention and cleanup

Logs are expected to grow over time.

Cleanup is already conceptually supported through `clean`, including
`clean logs`.

Additional retention behavior should be configurable through logging-related
settings, especially under `logging.stdout`, `logging.stderr`,
`logging.logtape`, or related logging configuration fields.

Potential controls may include:

- max retained runs
- max total size
- max age
- per-stream size limits

These policies should remain configurable rather than hard-coded.
