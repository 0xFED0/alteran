# FAQ

## Is Alteran A Replacement For Deno?

No. Deno is still the runtime. Alteran manages bootstrap, local runtime
materialization, project structure, and managed execution.

## Do I Need A Global Deno Install?

Not as the primary model. Alteran can seed or download a project-local managed
Deno runtime.

## Should I Commit `.runtime/`?

No. `.runtime/` is intended to be recoverable local state.

## What Is The Difference Between `setup` And `activate`?

`setup` bootstraps and repairs the project. `activate` enters the local shell
environment.

## Does Alteran Change Plain `deno run`?

No. Plain Deno stays plain. Alteran-managed commands opt into preinit, context,
and logging behavior.

## Is `view/` A Real GUI System Today?

No. It is a reserved placeholder, not the current center of the product.

## Can One Project Contain Both Apps And Tools?

Yes. That is part of the core project model.

## Is There A Portable AI Bundle For User Projects?

Yes. Alteran provides a portable AI user bundle under `docs/ai-user/`. It is
meant to be copied into an ordinary Alteran project and customized there if
needed.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Troubleshooting](./troubleshooting.md)
