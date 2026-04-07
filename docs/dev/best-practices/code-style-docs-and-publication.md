# Code Style, Docs, And Publication

## Prefer Small Orchestration Units In TypeScript

Most Alteran runtime code orchestrates:

- paths
- env
- files
- spawned processes
- generated artifacts

Keep functions small enough that one reader can hold the control flow in their head. Prefer discovery, normalization, and side effects to be visually separable.

## Favor Explicit Names Over Dense Cleverness

Names should describe the contract, not the mechanism.

Good Alteran-style names usually make it obvious whether a helper:

- resolves something
- ensures something
- syncs something
- warms something
- runs something

If the subtlety matters, let the name carry part of the explanation.

## Use Early Returns To Show Priority Order

Alteran often has:

- preferred local path
- fallback materialized path
- archive fallback
- failure path

Early returns make that order visible. Deep nesting tends to hide the real contract.

## Keep Environment Reads Near Boundary Code

Process env is global mutable state.

Prefer:

- boundary helper reads env
- normalized values get passed down explicitly

Avoid letting deep helpers depend on ambient env unless that is their whole purpose.

## Keep Shell And Batch Output Readable

When TypeScript generates shell or batch code:

- keep the template understandable
- keep placeholders obvious
- keep Unix and Windows variants conceptually aligned

The generator should explain the output, not dump an opaque string blob.

## Keep Markdown Paragraphs Natural

Do not hard-wrap ordinary prose paragraphs just to satisfy an arbitrary source line width.

Prefer one natural line per paragraph unless Markdown syntax requires line-level structure, such as:

- lists
- headings
- tables
- block quotes
- fenced code blocks

## Specs First, Then Docs, Then Notes

When behavior changes:

1. update the numbered spec if the contract changed
2. update ADR if the change is architectural
3. update user/dev/reference docs
4. update best-practices notes

Do not let README or dev notes become the real source of truth by accident.

## Keep Terminology Stable

Prefer current public terms consistently:

- `setup`
- `activate`
- `shellenv`
- `external`
- `shell_aliases`

If old terms survive as compatibility aliases, document them as legacy rather than as the preferred story.

## Treat Publication Tooling As Product-Critical

`prepare_jsr` and `prepare_zip` are not random repo scripts. They encode real product assumptions about what Alteran publishes.

Keep publication surfaces aligned with the current product story:

- versioned publication output
- JSR as the main public surface
- `setup` / `setup.bat` included in release payloads
- generated local activation excluded from release payloads

## Practical Smells

- one function discovers, mutates, spawns, logs, and repairs all at once
- deep helpers silently depend on env
- generated-script templates are too dense to audit
- docs describe commands or config fields that no longer exist
- release artifacts and release docs disagree on the public entrypoint

## Related Source Of Truth

- [Architecture](../architecture.md)
- [Publication](../publication.md)
- [Design Rules](../design-rules.md)
- [Documentation Spec](../../spec/005-alteran_documentation_spec.md)
