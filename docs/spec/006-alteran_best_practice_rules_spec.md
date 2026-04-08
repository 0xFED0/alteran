# Alteran Best Practice Rules Specification

## 1. Purpose

This document defines implementation-oriented rules and contributor guardrails for working on Alteran itself.

Its audience includes:

- human maintainers
- occasional contributors
- coding agents and AI assistants

Unlike `docs/dev/best-practices/`, this document is normative. It exists to pin down high-value engineering rules that are easy to forget, easy to violate, and capable of causing wide regressions when ignored.

The companion files under `docs/dev/best-practices/` are human-friendly summaries derived from this spec, not a higher authority.

---

## 2. Relationship To Other Specs

This document does not replace the main product spec or the test/docs specs.

Authority order remains:

1. `001-alteran_spec.md` for product and architecture contracts
2. other numbered specs for tests, examples, documentation, and AI docs
3. ADRs for architectural rationale
4. this best-practice rules spec for implementation guardrails
5. `docs/dev/best-practices/` for contributor-facing summaries

If this file conflicts with `001-alteran_spec.md` or another numbered spec, the more specific or higher-level normative spec must win and this file should be corrected.

---

## 3. Core Contributor Rules

### 3.1 Default to non-destructive change

Contributors must prefer changes that preserve:

- user data
- repository state
- generated local state that is intended to be reused
- committed public bootstrap surfaces

Destructive cleanup must be:

- explicit
- user-visible
- justified by the current command contract

### 3.2 Keep ownership of files explicit

Every important file or directory should fit one clear bucket:

- authored source
- generated local artifact
- generated but intentionally committed surface
- publication artifact
- test or docs fixture

Contributors must not blur these buckets casually.

### 3.3 Fix generators, not only outputs

When a change affects generated files, the source-of-truth generator or template must be updated first unless the generated file itself is the true source-of-truth.

Manual spot-fixes to generated outputs must not be used as a substitute for fixing the generating logic.

### 3.4 Keep the repository honest

The repository must represent real distinctions instead of hiding them behind convenient naming.

Examples:

- `src/` is authored source
- `.runtime/` is generated local state
- `setup` may be committed and product-facing
- `activate` may be generated and local-only

If asymmetry is intentional, it should remain explicit.

Committed repository examples are part of this honesty rule. Contributors must not normalize repository examples by hand-waving away generated drift or by treating committed example directories as temporary workspaces.

### 3.5 Do not create split-brain trees

Contributors must avoid creating parallel locations that both claim to be the source of truth for the same concern.

This includes:

- duplicate spec trees
- parallel bootstrap entry models
- multiple authoritative config homes for the same concept
- shadow docs that redefine existing behavior

### 3.6 Normalize examples through the committed reset path

If repository examples need to be returned to their intended source-first baseline, contributors should use the committed `examples/reset.ts` helper or equivalent shared logic derived from it.

They should not rely on ad hoc shell deletion loops as the preferred shared workflow once a committed reset helper exists.

---

## 4. Bootstrap, Runtime, And Platform Rules

### 4.1 Keep `setup` and `activate` separate

`setup` is the public bootstrap, repair, and materialization surface.

`activate` is a generated local entrypoint for entering an already prepared environment.

Contributors must not quietly move bootstrap, repair, or download behavior into `activate`.

### 4.2 Keep `activate` lightweight and deterministic

Generated `activate` should:

- embed resolved absolute paths where practical
- avoid runtime path cleverness when generation already knows the correct path
- be sourced-only on Unix

If a project moved or changed platform/runtime layout, the recovery path is `setup`, not a smarter `activate`.

### 4.3 Set runtime cache boundaries early

Activation and generated launchers must establish the correct local Deno cache boundary before invoking Deno in a way that could resolve or write dependencies.

In practice this means `DENO_DIR` must be set early.

### 4.4 Keep shell and batch logic minimal

Shell or batch scripts should orchestrate, not own product policy.

Complex project decisions belong in TypeScript whenever possible.

When the shell layer grows complicated enough to encode architectural policy, contributors should move the decision logic into TypeScript.

### 4.5 Prefer path certainty over shell cleverness

Contributors should:

- normalize paths early
- embed known absolute paths in generated local scripts
- prefer simple and robust shell snippets over dynamic path tricks

Avoid shell-specific magic if the value can be determined once at generation time.

This applies to maintainer helpers too. If a repository helper can be expressed directly as TypeScript without a misleading shell wrapper, prefer the direct TypeScript entrypoint.

### 4.6 Use run sources only for execution bootstrap

`ALTERAN_RUN_SOURCES` are execution sources, not canonical installation sources.

Canonical runtime materialization should prefer:

1. local authored source
2. already materialized local runtime
3. archive sources

Contributors must not reintroduce designs where remote runnable sources become the authoritative source for local materialization.

### 4.7 Avoid recursive bootstrap designs

A running bootstrap path must not re-enter the same bootstrap path through the same remote source unless that flow is intentionally bounded and safe.

If a design relies on "bootstrap by recursively calling bootstrap", it should be treated as suspect.

### 4.8 Be honest about platform support

Support scope must remain explicit in code, tests, and docs.

If a platform is unsupported, contributors must:

- keep tests honest
- keep docs honest
- avoid accidental marketing drift

Known unsupported scenarios must not be quietly treated as supported.

---

## 5. Config, Context, Execution, And Logging Rules

### 5.1 Prefer explicit user-visible config

If behavior is visible to the user, it should be represented explicitly in config when practical.

This especially applies to aliases and shell conveniences.

Boolean or magical hidden transforms should not replace clear explicit config when the user may need to understand or edit the result.

### 5.2 Preserve user-authored entry state on refresh or reimport

Refresh and reimport should update discovered structure without erasing user-authored intent such as:

- explicit alias lists
- intentional path overrides
- preserved metadata

Discovery logic must not aggressively rewrite entry state unless the contract explicitly says so.

### 5.3 Resolve paths from the owning config context

Paths in `alteran.json` and `app.json` must resolve from the owning config context, not from arbitrary caller `PWD`.

Contributors must treat accidental `PWD`-relative behavior as a bug unless the command contract explicitly requires it.

### 5.4 Treat project context as project-scoped

Execution context variables such as:

- `ALTERAN_HOME`
- run IDs
- canonical root log directory variables

belong to one Alteran project context.

Crossing into another project through:

- `setup`
- `activate`
- `shellenv`
- generated app launchers
- `alteran from ...`

must replace or sanitize foreign inherited context rather than implicitly reusing it.

### 5.5 Keep cross-project execution explicit

Normal commands should not secretly target foreign Alteran projects.

Cross-project operation must remain explicit and noticeable through dedicated surfaces such as:

- `setup <dir>`
- `alteran external ...`
- `alteran from app ...`
- `alteran from dir ...`

`deno.json` must not be treated as a valid external Alteran context anchor.

Contributors must preserve the semantic distinction:

- `external` operates on a target from the caller's current Alteran context;
- `from` becomes the target context and may therefore initialize that target first if needed.

### 5.6 Keep managed execution explicit

Managed behavior belongs to explicit Alteran entrypoints.

Plain Deno should remain plain unless the user intentionally entered managed execution through Alteran-owned commands or generated launchers.

Contributors must treat accidental bypass of managed context in Alteran-owned flows as a product bug.

### 5.7 Keep canonical logging project-local

The canonical root log tree belongs under:

`<project>/.runtime/logs/`

External or custom log destinations may mirror or copy logs, but they must not replace the canonical project-local root log identity unless the product spec explicitly changes.

### 5.8 Messages are part of the interface

Error and status messages should state:

- what failed
- why that branch failed
- what the user can try next

Vague failure summaries should be avoided when more actionable messaging is possible.

---

## 6. Testing, Examples, And Regression Rules

### 6.1 Prefer signal over artificial greenness

Tests should expose real product behavior. They should not be weakened merely to remove noise from CI or local runs.

Unsupported scenarios should be modeled honestly rather than made to look green through vague assertions.

### 6.2 Test through real product flows

High-value coverage should prefer real user flows over synthetic helper-only tests when practical.

Important examples include:

- repository-local setup
- copied setup bootstrap
- activation
- generated launcher behavior
- standalone app first-run setup
- managed execution through Alteran commands

### 6.3 Maintain test hermeticity

Tests that spawn or activate other Alteran projects must carefully control inherited environment and working-directory assumptions.

Contributors should assume that leaked context is a likely failure mode.

### 6.4 Prefer deterministic local fixtures

Tests should prefer local, deterministic fixtures over external network dependencies whenever practical.

If a test requires local servers, archives, or release fixtures, those requirements should be explicit and reproducible.

### 6.5 Treat examples as contracts

Examples are part of the public product story.

If an example appears supported, contributors should keep it:

- runnable
- documented honestly
- aligned with tests

### 6.6 Treat docs flows as product flows

Quick-start, copied-project, and executable documentation flows must be treated as product surfaces, not as editorial extras.

Tests must not pass only because the repository or developer machine is already warmed up.

### 6.7 Reproduce first, then generalize

When fixing a regression:

1. reproduce the smallest honest case
2. add or tighten the relevant test
3. then generalize helpers if useful

Contributors should avoid "fixing" a regression only by broad speculative refactoring.

### 6.8 Revalidate beyond the narrow failing test

Changes to setup, activation, generated scripts, runtime materialization, examples, docs flows, or logging should trigger broader validation than the single failing test.

At minimum, contributors should revisit nearby unit, e2e, example, or docs coverage that shares the same surface.

---

## 7. Code Style, Documentation, And Publication Rules

### 7.1 Prefer small orchestration units

Much of Alteran runtime code coordinates files, paths, env, process spawning, and generated artifacts.

Contributors should keep orchestration code small enough that one reader can visually follow:

- discovery
- normalization
- fallback order
- side effects

### 7.2 Favor explicit names over clever compression

Names should communicate contract and role.

Helpers should make it obvious whether they:

- resolve
- ensure
- sync
- warm
- materialize
- run

### 7.3 Use early returns to show fallback order

Alteran often has ordered fallback logic.

Contributors should prefer structures that make the priority order visually obvious instead of hiding it under deep nesting.

### 7.4 Keep environment reads near boundaries

Environment variables are global mutable state.

Boundary helpers should read and normalize env values, then pass normalized data inward explicitly whenever practical.

Deep helpers should not silently depend on ambient env unless that is their clear and narrow purpose.

### 7.5 Keep generated script templates understandable

Generated shell or batch templates must remain readable enough to audit.

Contributors must not turn templates into opaque string blobs that are hard to inspect, compare, or reason about.

### 7.6 Keep terminology stable

Preferred public terms should remain consistent across code, docs, help text, and tests.

Legacy names that survive only for compatibility must be treated as legacy, not as equal preferred vocabulary.

### 7.7 Update specs before derived docs

When behavior changes materially:

1. update the relevant numbered spec
2. update ADRs when the change is architectural
3. update user/dev/reference docs
4. update best-practices notes or AI overlays

Contributors must not let README files or advisory notes become the de facto primary source of truth.

### 7.8 Treat publication tooling as product-critical

Publication helpers such as `prepare_jsr` and `prepare_zip` encode real product assumptions.

Contributors must keep release outputs aligned with the current public product story and not treat publication tooling as disposable repo-only glue.

---

## 8. AI-Specific Contributor Rules

These rules apply especially strongly to coding agents and AI assistants.

### 8.1 Do not invent alternate architecture

An AI assistant must not introduce a second architecture model that conflicts with existing specs and ADRs simply because it seems locally convenient.

### 8.2 Prefer explicit over magical behavior

When choosing between a hidden clever shortcut and an explicit, visible, and configurable mechanism, the assistant should prefer the explicit mechanism unless the spec already requires the hidden one.

### 8.3 Preserve repository cleanliness

AI assistants must avoid:

- reviving removed legacy surfaces
- producing stray root artifacts
- converting local generated state into tracked clutter
- leaving generated outputs out of sync with their generators

### 8.4 Treat docs, tests, and generated files as part of the feature

For Alteran, code changes frequently require coordinated updates to:

- generators
- committed public bootstrap files
- tests
- examples
- docs
- specs or ADRs

An AI assistant should assume these are part of the same change unless the current request explicitly narrows scope.

### 8.5 Keep support claims honest

AI assistants must not silently broaden support statements in docs or code.

If behavior is not truly supported or not validated, the assistant should keep that scope explicit.

---

## 9. Specification For `docs/dev/best-practices/`

This section defines the minimum intended file set and content contract for the contributor-facing best-practices directory.

The purpose of those files is to provide concise, practical summaries derived from numbered specs, ADRs, and recurrent regressions.

They are not meant to become another normative source.

### 9.1 Required directory

The repository should contain:

`docs/dev/best-practices/`

### 9.2 Required files

The directory should contain exactly these core files unless a later spec intentionally changes the set:

- `README.md`
- `safety-and-repository-hygiene.md`
- `bootstrap-runtime-and-platform-boundaries.md`
- `config-context-execution-and-logging.md`
- `testing-examples-and-regression-discipline.md`
- `code-style-docs-and-publication.md`

### 9.3 `README.md` contract

`README.md` should:

- explain that the directory is advisory, not normative
- point readers back to `docs/spec/` and `docs/adr/` as higher authority
- provide a recommended reading order
- state the intent of the directory
- provide simple navigation back to the main docs/dev tree

### 9.4 `safety-and-repository-hygiene.md` contract

This file should summarize rules and smells related to:

- non-destructive change
- file ownership buckets
- generated vs committed surfaces
- generator-vs-output responsibility
- repository cleanliness
- avoiding split-brain trees

### 9.5 `bootstrap-runtime-and-platform-boundaries.md` contract

This file should summarize rules and smells related to:

- `setup` vs `activate`
- generated activation constraints
- sourced-only activation on Unix
- early cache boundary setup
- minimal shell logic
- path certainty
- run-sources vs archive-sources
- avoiding recursive bootstrap
- platform support honesty

### 9.6 `config-context-execution-and-logging.md` contract

This file should summarize rules and smells related to:

- explicit config
- alias visibility
- preserving user-authored state on reimport
- config-relative path resolution
- project-scoped context
- explicit cross-project execution
- managed execution boundaries
- canonical project-local logging
- actionable error messaging

### 9.7 `testing-examples-and-regression-discipline.md` contract

This file should summarize rules and smells related to:

- signal over greenness
- real user-flow tests
- hermeticity
- deterministic local fixtures
- examples as contracts
- docs as product flows
- reproduce-first regression handling
- broader validation after high-leverage changes

### 9.8 `code-style-docs-and-publication.md` contract

This file should summarize rules and smells related to:

- small orchestration units
- explicit names
- early returns for fallback order
- boundary-local env reads
- understandable generated templates
- terminology stability
- specs-first update discipline
- publication tooling as product-critical

### 9.9 Style and maintenance rules for `docs/dev/best-practices/`

Those files should:

- stay concise and practical
- avoid becoming hidden architecture specs
- avoid line-by-line duplication of numbered specs
- prefer synthesis over exhaustiveness
- drop low-value or stale advice rather than preserving it forever
- be merged or restructured when fragmentation becomes noisy

### 9.10 Reproducibility requirement

If the best-practices directory had to be recreated from scratch, it should be possible to rebuild the required files using:

- `001-alteran_spec.md`
- `002-alteran_tests_spec.md`
- `003-alteran_examples_spec.md`
- `004-alteran_examples_test_spec.md`
- `005-alteran_documentation_spec.md`
- this specification
- the AI docs specification
- current ADRs

No unique normative rule should live only inside `docs/dev/best-practices/`.
