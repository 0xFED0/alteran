# Skill: Managed Execution And Context

## Use When

- changing managed execution, preinit, `alteran run`, `alteran task`, or `alteran test`
- touching `ALTERAN_*` context propagation
- changing logging context, root log rules, or cross-project execution

## Read First

- `../../spec/001-alteran_spec.md`
- `../../spec/006-alteran_best_practice_rules_spec.md`
- `../../adr/0015-managed-execution-uses-preinit-while-plain-deno-stays-plain.md`
- `../../adr/0023-project-scoped-execution-context-and-canonical-log-root.md`
- `../../adr/0026-keep-logtape-config-project-local-and-log-context-lightweight.md`
- `../../dev/managed-execution.md`
- `../../dev/logging.md`
- `../repository-rules.md`

## Steps

1. Confirm whether the change affects same-project inheritance, cross-project boundaries, or plain-vs-managed execution semantics.
2. Preserve the rule that plain `deno run` and `deno task` stay plain unless Alteran is the explicit route.
3. Treat project-switching entrypoints as hard context boundaries.
4. Keep canonical logs under `.runtime/logs/` even when custom mirrors exist.
5. Keep heavy logging configuration in project config, not in transported env payloads.
6. Revalidate any touched tests or examples that depend on managed execution or logging context.

## Done Checklist

- [ ] Plain Deno semantics remain plain.
- [ ] Foreign project context does not silently become authoritative.
- [ ] Canonical root logging stays project-local.
- [ ] No heavy project config moved into env variables.
