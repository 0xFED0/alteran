# Alteran Documentation

This directory is organized as layered documentation instead of one flat pile of markdown files.

## Start Here

- [User docs](./user/overview.md): how to use Alteran in a project
- [Developer docs](./dev/overview.md): how Alteran itself is structured and changed
- [AI instructions](../AGENTS.md): short repository-level routing for coding agents
- [Portable AI user bundle](./ai-user/README.md): self-contained AI bundle for ordinary Alteran projects
- [AI dev docs](./ai-dev/README.md): repository-scoped AI overlays for changing Alteran itself
- [Reference docs](./reference/cli.md): concise command, config, layout, and environment lookup material
- [Examples](../examples/README.md): runnable project scenarios
- [ADR index](./dev/adr/index.md): architectural decisions and where the canonical ADR records live
- [Main product spec](./spec/001-alteran_spec.md): intended Alteran behavior and architecture requirements
- [Documentation spec](./spec/005-alteran_documentation_spec.md): documentation structure and writing requirements

## Recommended Paths

If you are new to Alteran:

1. Read [the repository README](../README.md).
2. Continue with [Getting Started](./user/getting-started.md).
3. Follow the fuller [Quickstart](./user/quickstart.md).
4. Use [Concepts](./user/concepts.md) and [Project Layout](./user/project-layout.md) to build the right mental model.

If you are changing Alteran itself:

1. Read [Dev Overview](./dev/overview.md).
2. Continue with [Local Development](./dev/local-development.md), [Repository Layout](./dev/repository-layout.md), and [Architecture](./dev/architecture.md).
3. Use [ADR Index](./dev/adr/index.md) when you hit a non-obvious constraint.

If you are an AI assistant:

1. Start with [AGENTS.md](../AGENTS.md).
2. If you are changing Alteran itself, continue with [AI Dev Docs](./ai-dev/README.md).
3. If you need a portable user-project bundle, use [AI User Bundle](./ai-user/README.md).
4. Follow the linked human docs, specs, and ADRs for the actual source of truth.
