# Architecture Decision Records

This directory contains Architecture Decision Records for Alteran.

ADR files capture decisions that are not obvious from the final specification
alone and that benefit from explicit rationale, tradeoffs, and consequences.

## Index

- [ADR 0001: Separate Runnable Bootstrap Sources from Materialization Sources](./0001-run-sources-vs-archive-sources.md)
- [ADR 0002: Limit Linux Runtime Support to GNU-Based Deno Targets](./0002-linux-runtime-support-scope.md)
- [ADR 0003: Test Suite Prioritizes Signal Over Greenness](./0003-test-suite-prioritizes-signal-over-greenness.md)
- [ADR 0004: Use Self-Hosted Bootstrap Fixtures for Remote Bootstrap Tests](./0004-self-hosted-bootstrap-fixtures-for-e2e.md)
- [ADR 0005: Keep Authored Alteran Source in `src/`, Not in `.runtime/`](./0005-src-is-the-authored-source-of-truth.md)
- [ADR 0006: `activate` Uses `ensure-env`, Not Full `init`, On Every Entry](./0006-activate-uses-ensure-env-not-init-every-time.md)
- [ADR 0007: Keep `alteran.ts` Thin and Use Node Only as a Bootstrap Bridge](./0007-thin-public-entrypoint-with-node-bootstrap-bridge.md)
- [ADR 0008: Stable Public Entrypoint vs Local Materialized Runtime](./0008-stable-public-entrypoint-vs-local-runtime.md)
- [ADR 0009: Separate Alteran Runtime from Runtime Helper Tools](./0009-separate-alteran-runtime-from-runtime-tools.md)
- [ADR 0010: Keep Bootstrap Shell Minimal and Put Real Logic in TypeScript](./0010-minimal-shell-bootstrap-and-typescript-owned-logic.md)
- [ADR 0011: Repository Layout Mirrors Managed Projects but Remains Distinct](./0011-repository-layout-mirrors-managed-project-but-remains-distinct.md)
- [ADR 0012: Use a Single `@libs/...` Alias with App-Local Shadowing](./0012-single-stable-libs-alias-with-app-local-shadowing.md)
- [ADR 0013: Separate External-Project Commands from Active-Project Commands](./0013-separate-external-project-commands-from-active-project-commands.md)
- [ADR 0014: Materialize and Cache Runtime Locally Instead of Running It Remotely on Every Invocation](./0014-materialize-and-cache-runtime-locally-instead-of-running-remotely.md)
- [ADR 0015: Managed Execution Uses Preinit While Plain Deno Stays Plain](./0015-managed-execution-uses-preinit-while-plain-deno-stays-plain.md)
- [ADR 0016: Prefer an Explicit Command Surface over Positional Magic](./0016-explicit-command-surface-over-positional-magic.md)
- [ADR 0017: Manage a Single Deno Version per Runtime and Separate `use` from `upgrade`](./0017-single-deno-version-per-runtime-and-separate-use-vs-upgrade.md)
- [ADR 0018: Use Versioned Publication Artifacts and Treat JSR as the Primary Public Surface](./0018-versioned-publication-artifacts-and-jsr-as-primary-public-surface.md)
- [ADR 0019: Use a Root Invocation Log Tree with Child Process Aggregation](./0019-root-invocation-log-tree-with-child-aggregation.md)
- [ADR 0020: Keep LogTape Optional and Integrate It via a Bare-Specifier Proxy](./0020-logtape-is-optional-and-integrated-via-bare-specifier-proxy.md)
- [ADR 0021: Reserve `view` as a Placeholder and Avoid Premature GUI Architecture](./0021-reserve-view-as-a-placeholder-and-avoid-premature-gui-architecture.md)

## Notes

These ADRs intentionally focus on decisions that are easy to forget, easy to
misinterpret, or likely to trigger future “why is it like this?” questions.
