# Alteran AI Docs Specification

## 1. Purpose

This document defines how AI-oriented repository guidance should relate to the existing Alteran documentation system.

Its goal is to help coding agents and human contributors work with the repository more accurately without creating a shadow specification or a second, conflicting docs tree.

This spec is intentionally grounded in the current Alteran repository layout and documentation model.

---

## 2. Current Documentation Reality

Alteran already has a layered documentation system under `docs/`:

- `docs/spec/` — normative numbered specifications
- `docs/adr/` — canonical Architecture Decision Records
- `docs/dev/adr/index.md` — contributor-facing ADR entrypoint
- `docs/user/` — user-facing usage docs
- `docs/dev/` — developer-facing repository docs
- `docs/reference/` — concise factual lookup docs

At the current repository state:

- `docs/spec/001-alteran_spec.md` is the main product and architecture spec
- `docs/spec/005-alteran_documentation_spec.md` governs the human documentation system itself
- `docs/spec/006-alteran_best_practice_rules_spec.md` defines normative implementation guardrails, including AI-relevant contributor rules
- this file governs how AI-oriented documentation should fit into the existing documentation system
- the repository-level routing file `AGENTS.md` exists
- the repository routing index `llms.txt` exists
- the tool-specific overlay `.github/copilot-instructions.md` exists
- the repository-scoped AI docs tree `docs/ai-dev/` exists
- the portable user-project AI bundle `docs/ai-user/` exists

AI-oriented guidance must therefore integrate with the existing documentation layers rather than pretending that a separate `docs/specs/` tree or some undocumented AI hierarchy already exists.

---

## 3. Goals

AI-oriented repository guidance should:

- provide a predictable entrypoint for coding agents
- reduce hallucinated naming, structure, and architecture
- route agents toward the real source of truth quickly
- make recurring repository workflows easier to execute consistently
- stay aligned with the numbered Alteran specs and ADRs
- remain understandable to human contributors

---

## 4. Non-Goals

AI docs are not intended to:

- replace `docs/spec/`
- replace `docs/adr/`
- redefine public behavior or architecture
- duplicate human docs line by line
- become a dumping ground for prompts or chat transcripts
- require a separate AI-only documentation tree when the existing docs already cover the same responsibility well

---

## 5. Source of Truth Hierarchy

When documents overlap, precedence is:

1. `docs/spec/001-alteran_spec.md` and other numbered files in `docs/spec/`
2. `docs/adr/` for architectural rationale and decision history
3. existing human docs under `docs/user/`, `docs/dev/`, and `docs/reference/`
4. repository-level AI entrypoint files such as `AGENTS.md`
5. optional tool-specific instruction files such as `.github/copilot-instructions.md`
6. repository-level routing/index files such as `llms.txt`
7. repository-scoped AI docs such as `docs/ai-dev/`
8. portable user-project AI bundles such as `docs/ai-user/`

Interpretation notes:

- `docs/spec/` governs contracts, terminology, layout, and intended behavior
- `006-alteran_best_practice_rules_spec.md` governs implementation guardrails and AI-relevant contribution rules
- ADRs govern why non-obvious architectural decisions exist
- human docs explain the system to readers and must remain aligned with the specs
- AI-specific docs are operational overlays only

If lower-priority guidance conflicts with higher-priority guidance, the lower-priority guidance must be corrected.

---

## 6. Core Principles

### 6.1 Single normative architecture

AI docs must not become a second architecture source of truth.

If an AI-oriented file contains a rule that affects:

- naming
- config shape
- public behavior
- repository layout
- runtime behavior
- testing or publication contract

that rule must already exist in `docs/spec/` or be added there in the same change.

### 6.2 Existing docs first

AI guidance should preferentially route into the existing human documentation tree before introducing new AI-only files.

If a workflow is already well described in:

- `docs/user/`
- `docs/dev/`
- `docs/reference/`

then AI docs should link to that material instead of restating it in full.

### 6.3 Human-readable first

AI docs must still be readable by human contributors. They should look like normal project documentation, not model-specific folklore.

### 6.4 Routing over duplication

Repository-level AI guidance should stay concise and navigational. Detailed procedures belong in focused playbooks, not in a giant root instruction file.

### 6.5 User and maintainer work are distinct

AI guidance for using Alteran in a project and AI guidance for modifying the Alteran repository must remain separated conceptually, even if they reuse the same underlying docs tree.

### 6.6 AI guidance must inherit implementation guardrails

AI-oriented docs must not bypass or weaken the implementation rules defined in `006-alteran_best_practice_rules_spec.md`.

In particular, AI guidance must remain aligned with the normative rules about:

- non-destructive change
- generator-vs-output responsibility
- bootstrap and activation boundaries
- `setup` as the only live bootstrap command surface
- project-scoped execution context
- explicit cross-project execution
- the semantic distinction between `external` and `from`
- lightweight internal context propagation vs project-local configuration
- hermetic tests and honest support scope
- spec-first synchronization discipline

---

## 7. AI Documentation Layers In Alteran

Alteran may use explicit AI-oriented files as long as they fit the existing docs model rather than competing with it.

### 7.1 `AGENTS.md` at repository root

If present, `AGENTS.md` should be the primary repository-level AI routing file.

It should contain only high-signal guidance:

- short project summary
- authoritative document list
- do/do-not rules
- minimal validation commands
- rules about spec / ADR updates
- links to implementation guardrails when modifying Alteran itself
- links into existing docs

It must not restate the full spec.

### 7.2 `.github/copilot-instructions.md`

This file may contain tool-specific operational guidance for GitHub Copilot or similar tooling.

It must stay short, remain subordinate to `AGENTS.md`, and must not conflict with `docs/spec/`.

### 7.3 `docs/ai-dev/`

Alteran may use a repository-scoped AI docs tree in this form:

```text
docs/ai-dev/
  README.md
  repository-rules.md
  agents/
  skills/
```

If `docs/ai-dev/` exists:

- `docs/ai-dev/README.md` must be a short index
- `docs/ai-dev/repository-rules.md` may provide a strict summary of mandatory repository rules derived from `docs/spec/` and ADRs
- `docs/ai-dev/agents/` may define reusable repository agent profiles
- `docs/ai-dev/skills/` should contain only reusable repository playbooks

If `docs/ai-dev/agents/` exists:

- agent profiles must define role/scope, not new architecture
- agent profiles must say whether they apply to repository work only or also describe current user-facing Alteran behavior for repository tasks
- reviewer profiles should remain review-focused and repository-scoped when the project says so

### 7.4 `docs/ai-user/`

Alteran may use a portable user-project AI bundle in this form:

```text
docs/ai-user/
  AGENTS.md
  llms.txt
  README.md
  agents/
  rules/
  skills/
```

If `docs/ai-user/` exists:

- it should be self-contained enough to copy into another Alteran project
- it should not require the full Alteran repository docs tree to remain useful
- it may summarize user-facing Alteran behavior compactly
- it may define portable user-project agent profiles such as an Alteran expert
- it must not become the only normative source of user-facing Alteran behavior inside the Alteran repository

### 7.5 `llms.txt`

If present, it should be a routing/index file only. It must not contain unique normative information.

---

## 8. Directory Responsibilities

### 8.1 `docs/spec/`

Canonical normative specifications.

For Alteran, this currently includes at least:

- `001-alteran_spec.md`
- `002-alteran_tests_spec.md`
- `003-alteran_examples_spec.md`
- `004-alteran_examples_test_spec.md`
- `005-alteran_documentation_spec.md`
- `006-alteran_best_practice_rules_spec.md`
- `007-alteran-ai-docs-spec.md`

### 8.2 `docs/adr/`

Canonical Architecture Decision Records.

### 8.3 `docs/dev/adr/index.md`

Contributor-facing ADR navigation layer inside the dev docs.

### 8.4 `docs/user/`

Human-facing usage docs. These are also valid first-stop materials for agents acting as project users.

### 8.5 `docs/dev/`

Human-facing repository-development docs. These are also valid first-stop materials for agents modifying Alteran itself.

### 8.6 `docs/reference/`

Compact factual docs for command surfaces, config fields, environment variables, layouts, logging structure, and cleanup behavior.

### 8.7 AI routing layers

AI-oriented layers such as `AGENTS.md`, `.github/copilot-instructions.md`, repository `llms.txt`, `docs/ai-dev/`, or `docs/ai-user/` should be treated as operational routing material, not as higher-authority replacements for the directories above.

---

## 9. Synchronization Rules

### 9.1 When architecture or public behavior changes

Update, in this order when relevant:

1. `docs/spec/`
2. `docs/adr/` if the change is architectural or reverses a past decision
3. human-facing docs under `docs/user/`, `docs/dev/`, and `docs/reference/`
4. optional AI routing or workflow docs

If the change affects contributor guardrails or AI-relevant implementation rules, `006-alteran_best_practice_rules_spec.md` must be updated before derived AI overlays or best-practice summaries.

### 9.2 When only workflow guidance changes

If architecture does not change, update the relevant human docs and optional AI docs without rewriting the main product spec unnecessarily.

### 9.3 When repeated AI work patterns appear

If a repository task pattern clearly repeats and would help future agents, it may be captured in:

- `docs/ai-dev/skills/` if that subtree exists
- another explicit repo-level skill/playbook location adopted by the project

But repeated workflow guidance must still reference the canonical spec and ADRs instead of inventing new rules locally.

### 9.4 When repository-level constraints are easy to violate

If the repository has a small set of high-risk mandatory constraints, Alteran may also keep a strict maintainer summary such as `docs/ai-dev/repository-rules.md`.

That file may restate mandatory repository rules in condensed form for AI maintainers, but it must remain derived from higher-priority sources and must not become the only place where those rules exist.

### 9.5 When Alteran wants a portable user-project AI bundle

If Alteran wants users to copy AI guidance into ordinary Alteran projects, it should package that material as a self-contained bundle such as `docs/ai-user/`.

That bundle should be updated when user-facing guidance changes materially, but it should stay compact and portable rather than mirroring the whole documentation tree.

---

## 10. Content Rules For AI-Oriented Docs

AI-oriented docs may include:

- reading order
- strict repository-rule summaries derived from canonical docs
- reusable agent-role profiles
- self-contained portable user-project bundles
- workflow sequences
- validation checklists
- repository-specific execution patterns
- safe-editing heuristics
- rules for when to update specs or ADRs

AI-oriented docs must not become the exclusive place for:

- config schema definitions
- public contract definitions
- canonical architecture descriptions
- naming standards that affect the whole project
- rationale that belongs in ADRs
- implementation rules that belong in `006-alteran_best_practice_rules_spec.md`
- mandatory repository rules that are not already defined in specs, ADRs, or existing human docs
- agent-role restrictions or review standards that affect the whole project but are not documented in higher-priority docs
- a portable user-project bundle that silently becomes the only place where core user-facing Alteran behavior is defined

AI-oriented docs must not:

- weaken explicit support boundaries
- normalize hidden magic that the specs reject
- treat advisory summaries as higher authority than numbered specs
- present temporary workarounds as the preferred long-term model
- reintroduce removed legacy command surfaces such as `init`
- describe heavyweight environment-variable transport for project configuration when the authoritative config belongs in project files such as `alteran.json`

---

## 11. Minimal Acceptable Current Baseline For Alteran

Given the current repository, the accepted AI-docs baseline is:

```text
AGENTS.md
.github/copilot-instructions.md
llms.txt
docs/spec/
docs/adr/
docs/dev/adr/index.md
docs/dev/best-practices/
docs/user/
docs/dev/
docs/reference/
docs/ai-dev/
docs/ai-user/
```

The `docs/dev/best-practices/` directory is not itself normative, but it is a useful derived layer for both humans and agents once the numbered specs and ADRs have been consulted.

---

## 12. Recommended Templates For Future Optional Files

### 12.1 Template for `AGENTS.md`

```md
# AGENTS.md

## Project summary
...

## Source of truth
- `docs/spec/001-alteran_spec.md`
- `docs/adr/`
- `docs/dev/`
- `docs/reference/`

## Rules
- ...

## Validation
- ...

## Change policy
- If architecture changes, update spec and ADR.
```

### 12.2 Template for `docs/ai-dev/README.md`

```md
# AI Dev Docs

## Purpose
This directory contains repository-scoped AI guidance for working with the
Alteran repository.

## Source of truth
The main project specification lives in `docs/spec/`.

## Directories
- `agents/` — repository agent profiles
- `skills/` — repeatable repository playbooks
```

### 12.3 Template for portable `docs/ai-user/AGENTS.md`

```md
# AGENTS.md

## What this bundle is for
...

## Read first
- `README.md`
- `rules/core-rules.md`

## Rules
- ...

## Validation
- ...
```

### 12.4 Template for a reusable skill/playbook

```md
# Skill: update spec

## Use when
...

## Read first
- `docs/spec/001-alteran_spec.md`
- `docs/adr/`

## Steps
1. ...
2. ...
3. ...

## Done checklist
- [ ] ...
- [ ] ...
```

---

## 13. Review Checklist

An AI-docs change should be reviewed against these questions:

- Does this duplicate `docs/spec/`?
- Does this introduce an architectural rule not present in `docs/spec/`?
- Should this be an ADR instead?
- Does it belong in existing human docs rather than a new AI-only file?
- Is the guidance reusable rather than one-off?
- Is the file concise enough for its role?
- Does it conflict with any higher-priority document?

If any answer indicates overlap or conflict, the content or placement should be corrected before merge.

---

## 14. Practical Policy For Alteran

For Alteran specifically:

- keep normative architecture in `docs/spec/`
- keep decision history in `docs/adr/`
- keep contributor-facing ADR navigation in `docs/dev/adr/index.md`
- keep `AGENTS.md` as the primary repository-level AI routing file
- keep `.github/copilot-instructions.md` as a thin tool-specific overlay
- keep repository `llms.txt` as a routing/index file only
- keep `docs/ai-dev/` repository-scoped and operational
- keep `docs/ai-user/` self-contained and portable
- allow `docs/ai-dev/agents/` for Alteran-specific reusable agent profiles such as a general Alteran expert or a repository-scoped Alteran reviewer
- allow `docs/ai-dev/repository-rules.md` as a strict derived summary for mandatory maintainer constraints
- allow `docs/ai-dev/skills/` for repeated high-value repository workflows
- prefer updating `docs/user/`, `docs/dev/`, and `docs/reference/` before expanding AI-only overlays
- avoid reviving hidden or legacy documentation roots or parallel spec trees outside the canonical `docs/spec/` layout
- do not reintroduce removed bootstrap vocabulary such as `init` when the live product contract uses `setup`
- do not teach AI overlays to pass heavyweight LogTape config through env when the live contract requires project-local configuration from `alteran.json`
- do not collapse `external` and `from` into one fuzzy cross-project mode
- do not teach AI that `external` implicitly becomes the target project context
- do not omit that `from` may initialize the target first because it intentionally becomes that target context

---

## 15. Final Rule

AI-oriented docs must make Alteran easier to change correctly, not easier to change creatively.

If an AI-specific document duplicates the spec, silently redefines architecture, or makes the repository harder to understand than the normal docs already do, it is malformed and should be rewritten or removed.
