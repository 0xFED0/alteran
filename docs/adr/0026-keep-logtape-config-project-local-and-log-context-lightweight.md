# ADR 0026: Keep LogTape Config Project-Local and Logging Context Lightweight

## Status

Accepted

## Context

Alteran propagates execution and logging identity across managed parent/child processes through environment variables such as:

- `ALTERAN_RUN_ID`
- `ALTERAN_ROOT_RUN_ID`
- `ALTERAN_PARENT_RUN_ID`
- `ALTERAN_ROOT_LOG_DIR`
- `ALTERAN_LOG_CONTEXT_JSON`

That propagation is useful because child processes need lightweight contextual information about the current invocation tree.

At the same time, Alteran also supports optional LogTape integration through `logging.logtape` in `alteran.json`.

A tempting implementation path is to serialize the effective LogTape config and pass it to children through an environment variable. That approach is flawed:

- it turns environment propagation into a heavy config transport
- it blurs the distinction between execution context and user configuration
- it makes cross-project behavior less trustworthy
- it duplicates configuration that already has a proper home in `alteran.json`

Alteran already treats project configuration as project-scoped and authoritative. Heavy logging configuration should follow the same rule.

## Decision

Alteran keeps two different responsibilities separate:

### 1. Lightweight runtime/logging context may propagate through env

`ALTERAN_LOG_CONTEXT_JSON` remains allowed as an internal Alteran-managed payload for lightweight parent/child logging context.

Its role is to carry execution metadata such as:

- run identity
- parent/root relationship
- recommended logging category context

It is an implementation detail of managed execution, not a user-facing configuration mechanism.

### 2. Heavy LogTape configuration stays project-local

Effective LogTape configuration must come from the current project's `alteran.json`, specifically `logging.logtape`.

When LogTape bootstrap happens inside a managed process, Alteran should read the current project's config from the project context indicated by the current runtime, not from a serialized heavy env payload.

This means:

- `logging.logtape: true` uses Alteran builtin default LogTape config
- `logging.logtape: { ... }` deep-merges user config over Alteran defaults
- the object is read from project config, not from a dedicated env variable

### Environment contract

Alteran should not introduce a user-facing environment variable whose purpose is “effective serialized LogTape config for this process”.

Environment variables are for lightweight process context here, not for moving large project configuration objects around.

## Consequences

### Positive

- clearer boundary between context propagation and project configuration
- less fragile cross-project behavior
- lower risk of heavy env payload drift
- LogTape behavior stays aligned with the authoritative project config source

### Tradeoffs

- LogTape bootstrap needs project-config lookup instead of a simple env read
- managed processes depend more directly on valid project context when reading logging configuration

## Rejected alternatives

### Serialize the effective LogTape config into an env variable

Rejected because it makes env propagation too heavy and turns project config into an implicit transport layer.

### Treat `ALTERAN_LOG_CONTEXT_JSON` as a user-facing logging config surface

Rejected because its purpose is execution context propagation, not user configuration.
