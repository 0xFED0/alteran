# ADR 0031: Manage Repository Examples Through a Dedicated `examples` Tool

## Status

Accepted

## Context

Alteran treats `examples/` as a first-class product-facing gallery rather than as decorative repository content.

That gallery already has several important properties:

- it is governed by a dedicated examples spec and examples testing spec;
- it contains maintained runnable scenarios, not random snippets;
- it mixes ordinary managed-project examples with at least one structurally different standalone-app-oriented example;
- it already has two validation layers:
  - repository-level example tests under `tests/examples/`;
  - per-example `tests/` directories inside example trees.

The current maintenance model is still fragmented.

Today, maintainers typically manage examples through a mixture of:

- ad hoc shell loops;
- manual `cd` into one example at a time;
- direct use of `./setup`, `alteran refresh`, `alteran compact`, and `alteran test`;
- repository-level example tests whose relationship to concrete examples is currently implicit rather than explicit.

The repository also has a hygiene problem around committed example trees.

Examples are intentionally committed in a source-first shape, but local maintainer work can leave behind generated artifacts such as:

- generated activation files;
- local `.runtime/` trees;
- nested app runtimes;
- build outputs;
- other recoverable material that is not part of the intended committed teaching shape.

This is especially visible for examples such as `01-bootstrap-empty-folder`, where the intended teaching point depends on preserving an almost-empty bootstrap-first starting state.

This fragmentation creates several problems.

### 1. Example maintenance is harder than it should be

There is no single repository-maintainer surface for operations such as:

- set up one example;
- refresh a subset of examples;
- clean or compact all examples;
- run only the tests associated with selected examples.

That makes examples harder to maintain as a curated gallery.

### 2. Example selection is not modeled explicitly

Maintainers naturally think in terms of example paths such as:

- `01-bootstrap-empty-folder`
- `06-refresh-reimport`
- `advanced/logtape-categories`

But current maintenance flows are organized around raw shell commands or around test filenames rather than around those example identities.

### 3. The test-to-example relationship is not first-class

The repository already has explicit example tests under `tests/examples/`, but their association with example directories is currently convention-based and partly accidental.

This becomes especially visible when one test file protects more than one example scenario, as in the current advanced examples coverage.

That makes it harder to answer questions such as:

- which test protects this example?
- which examples are still relying on internal tests only?
- what should `test` mean when I select one or two examples by path?

### 4. Public CLI scope should stay clean

The desired workflow is primarily for maintainers of the Alteran repository's example gallery.

It is not a core end-user command family on the same level as:

- `app`
- `tool`
- `refresh`
- `test`
- `clean`
- `compact`

Promoting repository-gallery maintenance directly into the public top-level Alteran command surface would blur the line between:

- normal Alteran project behavior;
- repository-specific contributor tooling.

That would conflict with the existing command-model preference for explicit, teachable boundaries.

At the same time, the repository-example workflow depends on product-level portability primitives that are useful beyond `examples/`.

Those portability decisions are related, but they are not repository-example policy by themselves.

So the solution must split cleanly into:

- repository-maintainer orchestration for `examples/`;
- reusable product-level portability primitives that the examples tool can call.

## Decision

Alteran should manage the repository example gallery through a dedicated repository tool named `examples`, rather than through a new top-level public CLI family.

The intended maintainer entrypoint is:

```sh
alteran tool run examples <subcommand> [example-path ...]
```

The supported subcommands are:

- `reset`
- `setup`
- `refresh`
- `clean`
- `compact`
- `test`

Example arguments are paths relative to the repository `examples/` directory.

Examples:

```sh
alteran tool run examples reset
alteran tool run examples setup
alteran tool run examples setup 02-multi-app-workspace 06-refresh-reimport
alteran tool run examples test advanced/logtape-categories
alteran tool run examples compact 07-compact-transfer-ready
```

If no example paths are provided, the tool operates on the full maintained example set in a deterministic repository-defined order.

### 1. A committed example catalog becomes the source of truth

The repository should introduce a small committed example catalog owned by the `examples` tool.

That catalog should become the maintainer-facing source of truth for the example gallery.

At minimum, each example record should declare:

- the example path relative to `examples/`;
- its support tier, such as `core` or `advanced`;
- its operational root when that differs from the visible example directory;
- whether it follows the ordinary managed-project flow or needs specialized handling;
- its associated repository-level example test file when one exists;
- any command overrides needed for structurally unusual examples.

This catalog exists to make the example gallery explicit and teachable for maintainers.

It should avoid turning into a second documentation tree or a hidden shadow spec.

### 2. Example identity is path-based, not filename-based

The canonical selector for an example is its path relative to `examples/`.

For example:

- `01-bootstrap-empty-folder`
- `07-compact-transfer-ready`
- `advanced/logtape-categories`
- `advanced/standalone-app-runtime`

The tool must not treat test filenames as the primary identity model.

This keeps maintainer workflows aligned with how the gallery is actually presented in:

- `examples/README.md`;
- example README links;
- specs and contributor docs.

### 3. The tool owns example-level orchestration, not product policy

The `examples` tool is a repository-maintainer orchestration layer.

It should primarily delegate to each example's own supported surfaces instead of inventing a parallel product model.

For ordinary managed-project examples, the defaults are:

- `reset`: run the repository's committed examples reset helper for the selected example paths;
- `setup`: run the example's `./setup`;
- `refresh`: prepare the example and run `alteran refresh` inside that example;
- `clean`: prepare the example and run safe cleanup through Alteran inside that example;
- `compact`: prepare the example and run `alteran compact -y` inside that example;
- `test`: run the associated repository-level test, or fall back to the example's own internal tests.

For structurally unusual examples, such as the standalone-app-runtime example, the catalog may declare explicit command adapters or overrides.

This keeps the common case simple without forcing every example into one rigid shape.

### 4. Example testing must be hermetic and temp-copy based

`alteran tool run examples test ...` should answer the maintainer question:

**"Run the validation that belongs to these example paths."**

It should do so without mutating the committed example trees in place.

The tool must not run example tests directly inside `examples/<path>` as its normal validation mode.

Instead, it should copy the selected example into a temporary directory and run setup and validation there.

The intended lifecycle is:

1. normalize the source example tree to its intended committed state;
2. create a compact bootstrap-ready temporary copy;
3. run `setup` against that temporary copy;
4. run the associated validation in that temporary copy.

This gives the hermeticity benefits of a `compact -> setup -> test` cycle without using the committed example directory itself as the scratch workspace.

#### 4.1 Source example trees are normalized before copy

Before creating a temp copy for testing, the repository should provide a lightweight reset step that removes generated or recoverable artifacts from committed example trees without rewriting user-authored code.

This step exists because a temp copy is only as trustworthy as its source tree.

If a committed example already contains stray generated state, copying it to temp does not restore the intended teaching shape.

The reset step should therefore delete only:

- generated activation files;
- `.runtime/` trees;
- nested app-local runtimes;
- `dist/`;
- other explicitly known generated artifacts that are not meant to stay in the committed example source tree.

It must not attempt to recreate business logic or overwrite authored files.

#### 4.2 The repository should include an examples reset script

The repository should include a small maintainer script under `examples/` for this normalization step.

The naming and policy of that script are governed separately by ADR 0034.

It may be implemented in `sh` or `ts`, but it should be:

- committed;
- path-selectable;
- idempotent;
- non-destructive to authored source;
- usable both manually and from the `examples` tool.

This script is particularly important for examples like `01-bootstrap-empty-folder`, where preserving the intended bootstrap-first starting state is part of the teaching contract.

#### 4.3 The temp copy should be bootstrap-ready, not live-runtime-copied

The temp copy used for testing should represent a compact transfer-ready project shape rather than a warmed-up local working directory.

That means test preparation should prefer copying only the bootstrap-ready project state, then rerunning `setup` inside the temp directory.

The test harness should not depend on:

- repo-local `.runtime/` leftovers;
- already-generated `activate` files in the source example;
- accidental warmed-up cache state in the committed example tree.

This keeps example validation aligned with the product story that examples are rehydratable from their committed bootstrap-ready surfaces.

### 5. `test` uses explicit example-to-test association plus internal fallback

That requires an explicit association model.

#### 5.1 Repository-level example tests

Repository-level example tests under `tests/examples/` should be modeled as associated with one concrete example each.

The intended steady state is:

- one repository-level example test file protects one example path;
- selecting an example path can therefore select its external test deterministically;
- the repository does not need to guess associations from naming conventions or grep results.

If a current repository-level test file protects more than one example, that should be treated as transitional structure rather than the ideal steady state. The examples tool may temporarily map more than one example selector to the same repository-level test file, but that mapping must be explicit in the catalog rather than inferred.

This means the current multi-example advanced test file is treated as transitional structure, not as the desired long-term contract.

#### 5.2 Internal fallback

If an example has no associated repository-level example test, `examples test` should fall back to running that example's internal tests from its own `tests/` directory.

For ordinary managed-project examples, the default fallback is:

```sh
alteran test -A ./tests
```

run from the example's operational root after the example has been prepared.

A placeholder `tests/.keep` directory does not count as meaningful internal test coverage.

If an example has neither:

- an associated repository-level example test;
- nor runnable internal tests;

then that should be treated as a maintainer-facing coverage gap rather than silently passing.

#### 5.3 Explicit over implicit

The association model should be stored as authored repository data, not inferred from:

- directory ordering;
- filename coincidence;
- README text parsing;
- scanning test source for copied example paths.

The goal is management clarity, not clever inference.

### 6. The `examples` tool should use portability primitives for test preparation

When `alteran tool run examples test ...` prepares a selected example, its preferred flow should be:

1. normalize the source example via the repo-local `reset` script;
2. create a temp destination;
3. create a transfer-ready temp copy through Alteran's product portability surface;
4. run `alteran setup <temp>` or the example-specific setup adapter;
5. run the associated external or internal tests in that temp copy.

This keeps the examples tool thin.

It also ensures the repository examples workflow is built on the same portability primitives that other Alteran users can use for non-repository projects.

The exact command shapes for those portability primitives are governed separately by:

- ADR 0032 for external-targeting `compact [dir]`;
- ADR 0033 for non-destructive `compact-copy`.
- ADR 0034 for the committed example `reset` script.

### 7. Default execution order is deterministic and curated

When no example paths are passed, the tool should process examples in a stable curated order derived from the catalog.

That order should reflect the maintained gallery rather than raw filesystem traversal.

This avoids accidental churn when:

- directory ordering changes;
- advanced examples are added;
- nested operational roots exist.

### 8. Execution stays sequential and honest

The initial contract should prefer sequential execution with clear per-example reporting.

The tool should:

- print which example is being processed;
- show which underlying command is being run;
- stop with a non-zero exit status if an example operation fails.

A later continue-on-error mode may be added if it proves useful, but it is not part of this initial decision.

This keeps failures high-signal and easier to diagnose.

## Consequences

### Positive

- maintainers get one explicit surface for repository example maintenance;
- example tests stop using committed example directories as scratch workspaces;
- example validation becomes closer to the real transfer-and-rehydrate story;
- example selection becomes path-oriented and easy to reason about;
- the test-to-example relationship becomes explicit instead of accidental;
- the repository gains an explicit way to normalize example trees without rewriting authored files;
- the examples workflow is explicitly built on top of product portability primitives instead of bespoke test-only copy logic;
- unusual examples can remain supported without forcing product CLI complexity;
- future contributors can answer "how do I manage or test examples?" without reinventing shell loops;
- the public Alteran CLI remains focused on end-user project behavior rather than repository-specific gallery maintenance.

### Tradeoffs

- the repository gains a small catalog that must be kept current;
- the repository gains a reset script that must be maintained alongside the example gallery;
- implementation will require splitting any repository-level example test files that currently cover multiple examples;
- the examples tool will need limited override support for structurally unusual examples;
- some maintainers may still choose direct shell commands for ad hoc work, but those commands are no longer the preferred shared workflow.

### Follow-up implications

Follow-up implementation should update:

- relevant user and dev docs where example-maintainer workflow is described;
- the examples and examples-testing specs if the new workflow becomes normative repository contract;
- the core command specs and user command docs for the portability primitives used by the examples workflow;
- repository tests covering the new `examples` tool itself.

## Rejected Alternatives

### Add a new top-level `alteran examples ...` command family

Rejected because this is repository-gallery maintenance behavior, not a core end-user project command surface.

Keeping it as a repository tool preserves the existing boundary between public product CLI and repository-maintainer orchestration.

### Keep using ad hoc shell loops and manual `cd`-driven workflows

Rejected because it preserves the current management fragmentation and keeps the test-to-example relationship implicit.

It also encourages mutating committed example directories directly during validation.

### Run example tests directly inside `examples/`

Rejected because it makes the repository tree itself the scratch workspace.

That increases the risk of:

- accidental repository pollution;
- hidden dependence on warmed-up local state;
- examples passing only because generated files were already present.

### Implement temp-copy example testing with ad hoc test-only copy filters and no shared portability primitive

Rejected because it would hide a reusable portability workflow inside repository-only harness code.

The examples tool should build on Alteran's shared portability surfaces rather than on bespoke test-only copy behavior.

### Infer test association from filenames only

Rejected because it is too brittle, especially once example paths and test files stop matching perfectly or when one test file covers multiple examples.

### Require every example to use only internal `tests/`

Rejected because some examples are more naturally protected by repository-level scenario tests that exercise copied temp projects, repo fixtures, or richer README-backed flows.

The right model is explicit association plus internal fallback, not forced uniformity.

### Keep repository-level example tests free to cover arbitrary mixtures of examples

Rejected because it makes targeted example selection and example ownership harder to reason about.

The desired steady state is one repository-level example test file per associated example.
