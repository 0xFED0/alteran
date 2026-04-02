# Alteran Examples Specification

## 1. Purpose

This document defines the purpose, structure, scope, and content rules for the `examples/` directory in the Alteran repository.

The goal of `examples/` is to demonstrate real, representative usage of Alteran through small, understandable, runnable projects. Examples must help a reader quickly understand:

- what Alteran is for;
- which workflows it improves;
- how project structure is expected to look;
- how code is organized in Alteran projects;
- what behavior is specific to Alteran rather than plain Deno;
- how a user can apply the same patterns in their own project.

Examples are not benchmark suites, not exhaustive test matrices, and not dumping grounds for random snippets. They are product-facing reference cases.

---

## 2. Main Goals of `examples/`

The `examples/` directory must serve several roles at once:

### 2.1 Show practical use cases

Examples must demonstrate realistic developer scenarios rather than artificial toy outputs only.

### 2.2 Explain the project model

Examples must make the Alteran project model visible in practice:

- `apps/`
- `tools/`
- `libs/`
- `tests/`
- `.runtime/`
- activation/bootstrap flow
- managed execution model

### 2.3 Demonstrate differentiating features

Examples should highlight the parts of Alteran that are not obvious from generic Deno usage alone.

### 2.4 Provide copyable starting points

A reader should be able to open an example, understand the intent, and adapt the same layout or approach for a real project.

### 2.5 Support documentation and onboarding

Examples should be directly referenceable from repository documentation and from command help where appropriate.

---

## 3. Non-Goals

The `examples/` directory must **not** be used as:

- a substitute for formal tests;
- a place for unstable experiments with unclear value;
- a catalog of edge-case compatibility shims;
- a kitchen sink of every supported command;
- a showcase of future or hypothetical features that are not part of the supported project story.

If something is mainly a fallback, compatibility escape hatch, or internal implementation concern, it should not be elevated into a primary example unless it is also a meaningful user-facing workflow.

---

## 4. Directory Structure

The `examples/` directory should be split into two levels:

```text
examples/
  01-bootstrap-empty-folder/
  02-multi-app-workspace/
  03-tools-workspace/
  04-managed-vs-plain-deno/
  05-logging-run-tree/
  06-refresh-reimport/
  07-compact-transfer-ready/
  advanced/
    logtape-categories/
    standalone-app-runtime/
```

### 4.1 Top-level examples

Top-level examples are the primary learning path. They must cover the core product story and be understandable in sequence.

### 4.2 `advanced/`

The `advanced/` subgroup contains valid, tested, supported examples that are more specialized or conceptually denser.

These examples are not experimental. They are simply not part of the shortest onboarding route.

---

## 5. Ordering Principles

Top-level examples should be ordered so that the reader naturally moves from first contact to deeper understanding.

Recommended order:

1. bootstrap and activation;
2. project structure with apps and libs;
3. tools as first-class project elements;
4. managed execution differences;
5. logging and runtime observability;
6. refresh/reimport synchronization;
7. compacting and transfer-ready workflow.

This sequence should answer the reader’s implicit questions in a sensible order:

- How do I start?
- What does a project look like?
- How do I organize code?
- What does Alteran actually add on top of Deno?
- What runtime behavior do I gain?
- How do I keep project state synchronized?
- How do I share, archive, or reset a project?

---

## 6. Example Design Requirements

Every example must satisfy the following requirements.

### 6.1 Small but meaningful

Each example should be small enough to understand quickly, but large enough to show a real pattern rather than a trivial one-line command.

### 6.2 Focused scope

Each example should have one main teaching objective and optionally one or two secondary ones. It should not try to explain the whole product at once.

### 6.3 Runnable

Each example must be runnable and structurally valid.

### 6.4 Inspectable

A reader must be able to inspect the tree and the code and clearly see where the Alteran-specific concepts live.

### 6.5 Copyable

The structure and code style should be suitable as a starting point for real projects.

### 6.6 Honest

Examples must not imply guarantees, behaviors, or supported flows that Alteran does not actually provide.

### 6.7 Minimal hidden magic

Examples should avoid relying on implicit behavior that is not documented nearby. If a behavior matters for understanding the example, it must be stated in the example README.

---

## 7. Standard Contents of an Example Directory

Each example directory should normally contain:

- `README.md`
- the example project files themselves;
- optional helper assets only if they directly improve understanding.

Examples should avoid unnecessary binaries, large generated outputs, or decorative assets.

### 7.1 `README.md` contract

Each example README should contain the following sections in some suitable form:

1. **What this example shows**
2. **Why it matters**
3. **Project shape / tree overview**
4. **How to run it**
5. **What to observe**
6. **Key Alteran concepts demonstrated**
7. **What this example intentionally does not cover**

The README should explain the idea and expected observations, not restate implementation internals in exhaustive detail.

### 7.2 Tree overview

Each example README should include a compact directory tree or equivalent structural summary.

### 7.3 Observation-oriented guidance

The README should direct the reader’s attention to important outcomes, such as:

- environment activation happened;
- root-level structure was created;
- one app resolves a different library than another;
- Alteran-managed execution injected context;
- logs were emitted and stored in expected places;
- refresh updated import/workspace state;
- compact removed regenerable local state.

---

## 8. Naming Rules

Example directory names should be:

- descriptive;
- short enough to scan easily;
- stable over time;
- action- or concept-oriented rather than cute or vague.

Recommended naming style:

- numeric prefix for primary examples;
- kebab-case descriptive slug;
- no marketing fluff;
- no ambiguous names such as `demo1`, `sample`, `misc`, or `playground`.

---

## 9. Required Primary Examples

## 9.1 `01-bootstrap-empty-folder`

### Goal

Demonstrate the first-run bootstrap story: starting from an empty or near-empty directory and entering a working Alteran-managed environment.

### What it should show

- root bootstrap contract files are sufficient to start;
- activation/bootstrap prepares local runtime state;
- a working project structure emerges;
- Alteran can be used without requiring a preinstalled global runtime as the primary dependency model.

### What the reader should understand

This is the fastest explanation of the product’s core value: local, reproducible project bootstrapping and environment entry.

### What to emphasize in README

- before/after state of the directory;
- what activation does conceptually;
- which parts are source-controlled vs generated locally;
- that the example is about entering a usable project, not about business logic.

---

## 9.2 `02-multi-app-workspace`

### Goal

Demonstrate the Alteran project structure through multiple apps and shared libraries.

### What it should show

- at least two apps under `apps/`;
- shared code under root `libs/`;
- app-local library override or shadowing behavior where appropriate;
- how a single project can contain multiple runnable app units while keeping shared code organized.

### What the reader should understand

Alteran is not just a bootstrap script. It defines a coherent project layout for multi-app development.

### What to emphasize in README

- root libs vs app-local libs;
- why shadowing exists and when it is useful;
- how this differs from a flat scripts folder or ad hoc monorepo arrangement.

---

## 9.3 `03-tools-workspace`

### Goal

Show that `tools/` are first-class project elements rather than incidental scripts.

### What it should show

- one or more small but realistic tools under `tools/`;
- shared support code through `libs/` where appropriate;
- tooling as part of the project model, not as unstructured shell fragments.

### What the reader should understand

Alteran can organize developer tooling, operational helpers, and project automation in the same structured environment as apps.

### What to emphasize in README

- why these are tools rather than apps;
- how the layout keeps tooling maintainable;
- how this reduces `scripts/` sprawl and local-environment drift.

---

## 9.4 `04-managed-vs-plain-deno`

### Goal

Explain the distinction between plain Deno execution and Alteran-managed execution.

### What it should show

- the same or similar code path run in plain and managed modes;
- visible differences in environment, injected context, preinit behavior, or execution semantics as supported by Alteran;
- that Alteran adds meaningful runtime behavior rather than merely aliasing Deno commands.

### What the reader should understand

This example should answer the question: “What do I gain when I run through Alteran instead of calling Deno directly?”

### What to emphasize in README

- which observations are expected to differ;
- which behavior is intentionally the same;
- that plain Deno remains valid, but Alteran-managed execution provides additional structure and context.

---

## 9.5 `05-logging-run-tree`

### Goal

Demonstrate structured runtime logging and invocation/run-tree visibility.

### What it should show

- a process that emits normal output and error output;
- a child invocation or nested command where relevant;
- resulting log artifacts and their conceptual roles;
- that execution produces inspectable runtime history rather than only terminal text.

### What the reader should understand

Alteran provides observability and execution trace structure that is useful for development tooling and complex project workflows.

### What to emphasize in README

- where logs are stored conceptually;
- what kinds of artifacts are produced;
- how parent/child or root/child execution relationships appear;
- why this matters beyond simple console output.

---

## 9.6 `06-refresh-reimport`

### Goal

Show how Alteran synchronizes project state after structural changes.

### What it should show

- a project change such as adding or moving a relevant unit;
- a refresh/reimport flow;
- resulting synchronized state visible to the user.

### What the reader should understand

Alteran is not a one-time generator. It maintains and refreshes project-level structure and metadata as the project evolves.

### What to emphasize in README

- what changed before refresh;
- what refresh updates conceptually;
- how this supports iterative development rather than only initial scaffolding.

---

## 9.7 `07-compact-transfer-ready`

### Goal

Demonstrate the compact/reset/share workflow for a project with recoverable local state.

### What it should show

- a project with local runtime or generated state present;
- compacting to a smaller, transfer-ready form;
- the idea that local runtime state can be recreated when needed.

### What the reader should understand

Alteran distinguishes between durable project source and regenerable local runtime state, which improves portability and repository hygiene.

### What to emphasize in README

- what is considered safe to compact away;
- what remains source-of-truth material;
- how a compacted project can be re-entered or restored.

---

## 10. Advanced Examples

## 10.1 `advanced/logtape-categories`

### Goal

Show a more advanced logging setup using supported LogTape integration and structured categories/context.

### What it should show

- intentional use of logging categories and context;
- integration with Alteran’s runtime logging model;
- a workflow that is valid and supported, but not necessary for first contact with Alteran.

### Why it is advanced

It assumes the reader already understands the basic execution and logging story.

### What to emphasize in README

- how this builds on the basic logging example;
- where structured logging adds value;
- that the example is about richer observability, not about introducing the basics.

---

## 10.2 `advanced/standalone-app-runtime`

### Goal

Show how an app behaves or can be reasoned about outside the normal in-project development flow, within the supported app runtime rules.

### What it should show

- the distinction between normal dev-project behavior and standalone-oriented behavior;
- what assumptions still hold and which ones change;
- how app runtime rules affect packaging or execution expectations.

### Why it is advanced

It is conceptually downstream from understanding the standard project model.

### What to emphasize in README

- which part is standard and which part is standalone-specific;
- that this is a supported usage story, but not the default onboarding case.

---

## 11. Content Style Guidelines

Examples should be written in a way that is easy to scan and reason about.

### 11.1 Prefer realistic names over nonsense placeholders

Use names that convey purpose, such as:

- `report-generator`
- `check-env`
- `hello-cli`
- `formatting`

Avoid opaque or throwaway names unless the example is intentionally minimal.

### 11.2 Keep logic simple

Business logic should stay small. The point is to reveal Alteran usage, not to bury it under app complexity.

### 11.3 Keep code readable

Examples should optimize for clarity over cleverness.

### 11.4 Avoid fake glamour

Do not add superficial complexity just to make an example look more impressive.

### 11.5 Make differences visible

When an example compares two modes or two structures, the important difference must be obvious from the output, layout, or README explanation.

---

## 12. Relationship to Tests

Examples and tests have different purposes.

- **Tests** verify correctness and regressions.
- **Examples** communicate usage, project shape, and user-facing behavior.

An example may be covered by tests, but it should still be written for human understanding first.

A tested feature does not automatically deserve an example. It should only become an example if it teaches an important part of the Alteran story.

---

## 13. Relationship to Documentation

The `docs/` directory explains the system in a general and architectural way.

The `examples/` directory shows what the system looks like in use.

Documentation should be able to link to examples as concrete references. Examples should in turn link back to conceptual documentation when deeper explanation is needed.

Examples should therefore be documentation-friendly, stable, and named predictably.

---

## 14. Maintenance Rules

Examples should be maintained with the same seriousness as other user-facing project assets.

### 14.1 Keep them valid

If a behavior changes, affected examples should be updated promptly.

### 14.2 Keep them aligned with the supported story

If an example stops representing a recommended or meaningful usage path, it should be revised, moved, or removed.

### 14.3 Avoid silent drift

README descriptions and actual example structure must stay aligned.

### 14.4 Prefer fewer strong examples over many weak ones

The directory should stay curated. Each example should justify its existence.

---

## 15. Acceptance Criteria

The `examples/` directory is considered well-formed when:

1. it presents a coherent onboarding path;
2. each top-level example has a distinct and useful teaching goal;
3. examples visibly demonstrate Alteran-specific value rather than generic Deno usage alone;
4. advanced examples are clearly separated from the primary learning path;
5. every example contains a readable README with observation-oriented guidance;
6. the set of examples collectively covers bootstrap, project structure, tools, managed execution, logging, refresh, and compact workflow;
7. the directory remains curated rather than exhaustive.

---

## 16. Summary

The `examples/` directory should act as a practical product gallery for Alteran.

It should help a user move from:

- “What is this project?”
- to “How is it structured?”
- to “What does it add on top of Deno?”
- to “How would I use it in my own repository?”

A strong examples set should make the value of Alteran legible through small, honest, runnable cases.
