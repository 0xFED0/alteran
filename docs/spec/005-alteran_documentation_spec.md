# Alteran Documentation Specification

## 1. Purpose

This document defines the documentation architecture for Alteran.

Its purpose is to make Alteran understandable and usable for two distinct audiences:

1. people who want to use Alteran in their own projects;
2. people who want to modify, extend, and develop Alteran itself.

The documentation must help a reader quickly find the correct layer of information without forcing them to read the full specification or infer core concepts from source code.

This document covers:

- repository-facing human documentation;
- usage documentation;
- development and contribution documentation for Alteran itself;
- reference documentation;
- the role and structure of the root `README.md`;
- the relationship between README, docs, examples, specification, and ADRs.

This document does not define GitHub-specific repository contribution workflows. Those may be documented separately.

Optional AI-oriented operational overlays may be documented separately as long as they remain subordinate to the main documentation model rather than replacing it.

---

## 2. Documentation Goals

Alteran documentation must satisfy the following goals.

### 2.1. Fast entry

A new visitor opening the repository must be able to understand within a few minutes:

- what Alteran is;
- what kind of problems it solves;
- how to initialize a project;
- how to create and run a minimal app and tool;
- where to continue reading.

### 2.2. Correct mental model

The documentation must explain the core concepts of Alteran clearly enough that users do not confuse:

- the Alteran source repository with an Alteran-managed project;
- plain Deno execution with Alteran-managed execution;
- authored source with generated or materialized runtime state.

### 2.3. Layer separation

The documentation must separate:

- conceptual explanations;
- practical how-to guidance;
- command and configuration reference;
- internal development guidance;
- architectural decisions.

A single document must not try to serve all of these purposes at once.

### 2.4. Practical usefulness

The documentation must provide runnable, minimal, concrete examples rather than only abstract explanation.

Documentation that references repository examples must also describe the repository-maintainer reset path for restoring committed examples to their intended source-first baseline when that workflow matters for contributors.

### 2.5. Future maintainability

The documentation structure must scale as Alteran grows, without turning into a flat and inconsistent pile of markdown files.

### 2.6. Portability story

Alteran documentation must clearly communicate that one of Alteran's central user-facing benefits is the portability of project folders.

The docs should help readers understand that:

- Alteran keeps runtime material local to the project on purpose;
- this reduces dependence on globally preinstalled tooling;
- a project can be moved, copied, or sent to another machine and restored there through `setup`.

---

## 3. Documentation Model

Alteran documentation must be divided into four main layers:

1. `README.md` — repository entry point and quick orientation;
2. `docs/user/` — documentation for people using Alteran in projects;
3. `docs/dev/` — documentation for people developing or modifying Alteran itself;
4. `docs/reference/` — concise factual reference.

A fifth related layer must exist for architectural reasoning:

5. `docs/dev/adr/` — contributor-facing ADR navigation.

Canonical ADR record files may live in `docs/adr/` as long as `docs/dev/adr/index.md` exists as the development-doc entrypoint that explains where the records live and links into them.

Alteran may also keep optional AI-oriented operational overlays such as:

- `docs/ai-user/` for a portable user-project AI bundle
- `docs/ai-dev/` for repository-scoped AI guidance

These overlays are not part of the main human documentation layers and must not replace them.

### 3.1. Responsibility of each layer

#### README

The root README is the repository landing page. It must help a new reader understand Alteran quickly and proceed to the right deeper documentation.

#### User docs

User docs explain how to use Alteran in real projects.

#### Dev docs

Dev docs explain how Alteran itself is structured and how to change it without violating project rules.

For repository-owned surfaces such as `examples/`, dev docs should explain both:

- the intended committed baseline;
- the maintainer workflow for resetting that baseline without treating the repository tree as disposable scratch space.

#### Reference docs

Reference docs provide concise, factual descriptions of commands, config, environment variables, layout rules, and similar material.

#### ADR docs

ADR docs explain non-obvious architectural decisions and why they were chosen.

---

## 4. Required Documentation Tree

The documentation must be organized approximately as follows.

```text
docs/
  README.md

  user/
    overview.md
    getting-started.md
    quickstart.md
    concepts.md
    project-layout.md
    activation.md
    commands/
      overview.md
      setup.md
      refresh.md
      app.md
      tool.md
      run-task-deno.md
      test.md
      clean.md
      update-upgrade-use.md
    guides/
      bootstrap-empty-project.md
      working-with-apps.md
      working-with-tools.md
      shared-libs.md
      tests.md
      standalone-apps.md
      logging.md
      mirrors-and-sources.md
    troubleshooting.md
    faq.md

  dev/
    overview.md
    local-development.md
    repository-layout.md
    architecture.md
    runtime-materialization.md
    command-model.md
    config-sync.md
    generated-files.md
    managed-execution.md
    logging.md
    testing.md
    publication.md
    design-rules.md
    adr/
      index.md

  reference/
    cli.md
    alteran-json.md
    deno-json-integration.md
    environment-variables.md
    project-layout.md
    app-layout.md
    tool-layout.md
    logging.md
    cleanup-scopes.md
```

Names may evolve slightly, but the separation of responsibilities must remain.

The current repository may also keep canonical ADR record files under `docs/adr/`, with `docs/dev/adr/index.md` acting as the contributor-facing ADR entrypoint inside the dev docs layer.

---

## 5. Root README Requirements

## 5.1. Role of the root README

The root `README.md` must serve as the entry point for the repository.

It must not try to replace the full documentation set.

It must answer the following questions quickly:

- What is Alteran?
- Why would someone use it?
- What does it look like in practice?
- How can a reader try it immediately?
- Where should the reader go next?

## 5.2. Required README structure

The root `README.md` should contain, in this general order:

1. project title and short description;
2. concise overview of what Alteran is;
3. a short feature summary or key ideas list;
4. a **Quick Start** section directly in README;
5. a short explanation of what the Quick Start demonstrates;
6. links to deeper documentation;
7. link to examples;
8. optional status / maturity / license sections.

The root README should remain concise enough to be readable as a repository landing page.

### 5.3. README support sections after Quick Start

After the main README Quick Start, the README may include one or two short supporting sections that reinforce major user-facing value without bloating the main walkthrough.

High-value examples include:

- a short section about portability of project folders;
- a short section about bootstrap fallback when Deno is not yet installed globally;
- a short section that clarifies repository-local bootstrap versus ordinary project bootstrap.

These sections should stay outside the main linear Quick Start flow.

---

## 6. README Quick Start Requirements

## 6.1. Purpose

The `Quick Start` section in the root `README.md` must provide a short, visually scannable, end-to-end walkthrough that a repository visitor can read with minimal effort.

It must allow a reader to quickly see:

- directory creation;
- one-line URL-based setup through the public Alteran package or locator entrypoint;
- entering the local project environment after bootstrap;
- creation of a minimal app and a minimal tool;
- a tiny code example for each;
- how each is run;
- the basic difference between app and tool usage.

This section must be optimized for **fast visual understanding**, not for exhaustive explanation.

## 6.2. Required Quick Start flow

The Quick Start must include all of the following steps in order.

### Step 1. Create a project directory

The README Quick Start must show:

```sh
mkdir project
cd project
```

The directory name may be different in final wording, but the flow must start from an empty directory created by the user.

### Step 2. One-line URL-based setup through the public entrypoint

The Quick Start must show a one-line setup command using the implemented public Alteran package or locator entry mechanism.

This must be presented as the minimal bootstrap path for trying Alteran from scratch.

The exact entrypoint and invocation syntax must match the implemented public bootstrap design.

If alternative bootstrap paths also exist, such as checked-in `setup` scripts, they should not replace the one-line public-entrypoint path as the primary Quick Start entry when Deno is already available.

### Step 3. Enter the local environment

After bootstrap, the Quick Start must show the supported activation step needed to enter the project's local environment before continuing with normal Alteran-managed commands.

### Step 4. Create a minimal app template

The Quick Start must show creation of a minimal app using the intended public user-facing command flow.

### Step 5. Create a minimal tool template

The Quick Start must also show creation of a minimal tool using the intended public user-facing command flow.

### Step 6. Show minimal code for the app

The Quick Start must include a tiny code example placed into the app, small enough to read instantly.

The code should demonstrate that the app is a runnable Alteran app and should be clearly recognizable as app code.

### Step 7. Show minimal code for the tool

The Quick Start must include a tiny code example placed into the tool, small enough to read instantly.

The code should demonstrate that the tool is a runnable Alteran tool and should be clearly recognizable as tool code.

### Step 8. Run the app

The Quick Start must show the command used to run the app.

### Step 9. Run the tool

The Quick Start must show the command used to run the tool.

## 6.3. Required presentation qualities

The README Quick Start must be:

- short;
- linear;
- copy-paste-friendly;
- readable without prior Alteran knowledge;
- concrete rather than abstract;
- small enough that a person can visually scan it on the repository front page.

## 6.4. Quick Start must include both app and tool

The README Quick Start must show both an app and a tool.

The purpose is not to fully teach both systems, but to immediately demonstrate that Alteran treats both as first-class project units and that they have related but distinct creation and execution flows.

## 6.5. Quick Start must remain intentionally shallow

The Quick Start in README must not contain:

- deep explanation of internal runtime materialization;
- full command reference;
- detailed project layout explanation;
- advanced logging or config details;
- troubleshooting discussion;
- large multi-file code examples.

Those belong in deeper docs.

## 6.6. Fallback bootstrap belongs outside the main Quick Start flow

If the README documents bootstrap fallback for environments that do not yet have global Deno available, that explanation should live outside the main Quick Start sequence.

Suitable examples include:

- "download `setup` from this repository";
- "use a checked-out repository copy and run `./setup <dir>`".

The point is to preserve one clean primary Quick Start while still documenting important practical fallback paths nearby.

## 6.7. Required link to the full quickstart doc

Immediately after the README Quick Start, the README must include a link to a more detailed quickstart document.

That deeper document must live in user documentation, using a location such as:

- `docs/user/quickstart.md`

or an equivalent path if naming changes.

The README Quick Start must explicitly tell the reader where to go for a fuller guided walkthrough.

---

## 7. Detailed Quickstart Document Requirements

A dedicated quickstart document must exist in user documentation.

Recommended path:

- `docs/user/quickstart.md`

## 7.1. Purpose

This document expands on the README Quick Start without becoming full reference documentation.

It should guide the reader through a first realistic interaction with Alteran while still remaining beginner-oriented.

## 7.2. Required content

The detailed quickstart should include:

- the same general starting flow as the README quick start;
- a little more explanation around bootstrap and activation;
- expected resulting project structure at a high level;
- app creation and tool creation;
- tiny runnable code examples;
- app and tool execution;
- brief explanation of what is happening conceptually;
- pointers to next docs: concepts, commands, guides, examples;
- if helpful, a short explanation of bootstrap fallback paths for machines where Deno is not yet installed globally.

## 7.3. Boundaries

The detailed quickstart still should not become the full command reference or architecture guide.

It must remain a guided getting-started document.

---

## 8. User Documentation Requirements

## 8.1. Purpose

User documentation must explain how to use Alteran in regular projects.

It must prioritize practical usage, conceptual clarity, and discoverability.

## 8.2. Required user docs

### `docs/user/overview.md`

Must explain what Alteran is, what kind of tool it is, and what main capabilities it provides.

### `docs/user/getting-started.md`

Must orient a new user and point to the Quick Start and the most important concept docs.

### `docs/user/quickstart.md`

Must provide a fuller guided first-use walkthrough.

### `docs/user/concepts.md`

Must explain the core mental model of Alteran, including concepts that users need in order to reason correctly about the system.

### `docs/user/project-layout.md`

Must explain the structure of an Alteran-managed project and the purpose of the main directories.

### `docs/user/activation.md`

Must explain activation flow, shell environment setup, and related user-facing behavior.

### `docs/user/commands/*`

Must provide practical documentation for the major command families.

### `docs/user/guides/*`

Must provide task-oriented practical walkthroughs.

### `docs/user/troubleshooting.md`

Must help diagnose common user-facing issues.

### `docs/user/faq.md`

Must answer short recurring questions that do not need long narrative explanation.

## 8.3. User command docs responsibilities

The command docs should describe the purpose and expected behavior of user-facing command groups, such as initialization, refresh, app and tool management, run/task/deno distinctions, testing, cleanup, explicit external-project execution if supported, and version/runtime related commands.

## 8.4. User guides responsibilities

The guides must teach practical workflows, such as:

- starting from an empty directory;
- working with apps;
- working with tools;
- working with shared libraries;
- using tests;
- working with standalone apps if supported;
- reading logs;
- using mirrors and source settings;
- understanding portable project folders and project-local bootstrap.

---

## 9. Development Documentation Requirements

## 9.1. Purpose

Development documentation must explain how to work on Alteran itself.

It is not about contributing to a hosting platform setup. It is about local development, architecture, generated state, command design, testing, and publication-related structure for Alteran.

## 9.2. Required dev docs

### `docs/dev/overview.md`

Must explain the purpose of the dev docs and help contributors navigate them.

### `docs/dev/local-development.md`

Must explain how to work on Alteran locally and what is considered source-of-truth versus generated state.

### `docs/dev/repository-layout.md`

Must explain the structure of the Alteran source repository.

### `docs/dev/architecture.md`

Must explain the major subsystems and their responsibilities.

### `docs/dev/runtime-materialization.md`

Must explain how runtime materialization works and what belongs to authored source versus materialized runtime state.

### `docs/dev/command-model.md`

Must describe how Alteran commands are conceptually structured and how that structure should evolve.

### `docs/dev/config-sync.md`

Must explain how project sync behavior works conceptually.

### `docs/dev/generated-files.md`

Must describe which files are generated, regenerated, repaired, or materialized.

### `docs/dev/managed-execution.md`

Must explain the model and boundaries of managed execution.

### `docs/dev/logging.md`

Must describe the internal logging model and its responsibilities.

### `docs/dev/testing.md`

Must describe the testing model, expectations, and major test categories.

### `docs/dev/publication.md`

Must explain publication-related structure and behavior.

### `docs/dev/design-rules.md`

Must document the core design rules and constraints that should guide future changes.

### `docs/dev/adr/index.md`

Must provide navigation for architectural decision records.

---

## 10. Reference Documentation Requirements

## 10.1. Purpose

Reference documentation must provide concise factual lookup material.

It must not try to teach everything from first principles.

## 10.2. Required reference topics

Reference documentation should cover, at minimum:

- CLI command map and command families;
- `alteran.json` structure;
- interaction with `deno.json`;
- relevant environment variables;
- explicit external-project execution entrypoints if supported;
- project, app, and tool layout expectations;
- logging structure;
- cleanup scopes and cleanup-related command behaviors.

## 10.3. Style of reference docs

Reference docs should be concise, structured, and easy to scan.

Tables, compact lists, schemas, and short field descriptions are appropriate here.

---

## 11. Relationship Between Documentation Layers

The documentation system must maintain the following boundaries.

### 11.1. README vs docs

README provides entry and orientation. Detailed explanation belongs in `docs/`.

### 11.2. User docs vs dev docs

User docs explain how to use Alteran. Dev docs explain how to change Alteran.

### 11.3. Docs vs reference

Narrative explanation and guided learning belong in docs. Compact factual lookup belongs in reference.

### 11.4. Docs vs examples

Documentation explains and guides. Examples demonstrate runnable project scenarios. Each should link to the other where helpful.

### 11.5. Docs vs specification

Specification defines the intended system behavior and architectural requirements. Documentation explains the system to humans. Documentation must not silently contradict the specification.

### 11.6. Docs vs ADR

ADRs explain why non-obvious architectural decisions were made. They are not a substitute for user guides or reference docs.

---

## 12. Writing Principles

All human-facing Alteran documentation should follow these rules.

### 12.1. Prefer clarity over density

Documentation must be understandable without requiring readers to reverse-engineer the project.

### 12.2. Prefer concrete examples over abstract statements

Whenever practical, docs should show a short command or code example.

### 12.3. Keep conceptual and reference material separate

Avoid mixing deep architecture discussion into beginner-facing quickstart material.

### 12.4. Do not overload README

README should stay strong as a landing page. If a topic needs depth, link to docs rather than bloating the front page.

### 12.5. Preserve accurate terminology

The documentation must use consistent project terminology. Important terms must not drift between files.

### 12.6. Avoid implementation leakage in high-level docs

High-level docs should explain intended behavior and mental model, not force the reader through irrelevant implementation details.

### 12.7. Avoid pretending placeholders are primary features

Reserved or future-oriented capabilities must not be presented as if they are already central end-user workflows.

### 12.8. Prefer human, editorial wording over spec-like stiffness

Documentation may be informed by specifications, but it should not read like a specification unless the page is itself a specification or reference sheet.

When two phrasings are equally correct, prefer the one that sounds more natural to a human reader.

### 12.9. Preserve editorial consistency

Small editorial conventions should stay consistent across the docs.

Examples:

- use lowercase `vs`, not `Vs` or `VS`, in headings and prose;
- keep headings readable rather than mechanically title-cased;
- avoid awkward or over-technical phrasing when a simpler wording would do.

---

## 13. Cross-Linking Requirements

The documentation must be cross-linked intentionally.

At minimum:

- README Quick Start must link to detailed quickstart docs;
- README must link to user docs, dev docs, and examples;
- user overview docs should link to concepts and quickstart;
- command overviews should link to relevant guides and reference docs;
- dev overview should link to architecture, repository layout, and testing;
- examples should be linked from relevant user docs where helpful;
- each user/dev/reference page should include an easy path back to the docs index;
- where pages form a logical sequence, previous/next navigation is encouraged and may be required by project convention.

Cross-linking must reduce reader confusion, not create loops of empty navigation.

---

## 14. Suggested Implementation Priority

Documentation implementation should proceed in phases.

### Phase 1

High-priority docs:

- root `README.md`;
- README Quick Start;
- `docs/user/overview.md`;
- `docs/user/getting-started.md`;
- `docs/user/quickstart.md`;
- `docs/user/concepts.md`;
- `docs/user/project-layout.md`;
- `docs/user/commands/overview.md`;
- `docs/dev/overview.md`;
- `docs/dev/local-development.md`;
- `docs/dev/repository-layout.md`;
- `docs/dev/architecture.md`.

### Phase 2

Second-wave docs:

- user command family docs;
- user guides;
- troubleshooting;
- runtime materialization;
- config sync;
- testing;
- reference docs.

### Phase 3

Later docs:

- publication details;
- design rules;
- ADR index and supporting ADR navigation;
- FAQ refinement and overall polish.

---

## 15. Acceptance Criteria

This documentation initiative is considered complete for its first meaningful milestone when all of the following are true:

1. the root README contains a short Quick Start directly on the repository front page;
2. the README Quick Start shows project creation, one-line URL-based setup through the public entrypoint, activation, app creation, tool creation, minimal code, and running both;
3. the README Quick Start links to a more detailed quickstart document;
4. user docs, dev docs, and reference docs exist as separate top-level documentation areas under `docs/`;
5. the responsibility of each documentation layer is clear and non-overlapping;
6. a new user can find beginner guidance without reading implementation docs;
7. a contributor can find architecture and development guidance without digging through user docs;
8. the docs structure is suitable for expansion as Alteran evolves.

---

## 16. Non-Goals

The following are outside the scope of this document:

- GitHub-specific pull request process documentation;
- CI policy details unless they are directly relevant to local Alteran development docs;
- exhaustive command reference wording;
- implementation of the examples themselves;
- implementation details of specific markdown rendering systems.

---

## 17. Summary

Alteran documentation must be intentionally structured rather than accumulated.

The root README must act as a strong front door with a real Quick Start that demonstrates the product immediately.

User docs must teach usage. Dev docs must teach internal development. Reference docs must support factual lookup. ADRs must preserve architectural reasoning.

Together, these layers must make Alteran understandable both as a tool to use and as a project to evolve.
