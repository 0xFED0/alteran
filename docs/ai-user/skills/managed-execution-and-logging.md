# Skill: Managed Execution And Logging

## Use When

- explaining or using Alteran-managed execution
- comparing managed routes with plain Deno
- checking where logs and run context belong

## Steps

1. Use Alteran command routes when managed execution is desired.
2. Preserve the distinction between managed execution and plain Deno behavior.
3. Treat project-local context as belonging to one Alteran project.
4. Treat `.runtime/logs/` as the canonical project-local log root.
5. Do not explain logging or context as shell-global across unrelated projects.

## Done Checklist

- [ ] Managed and plain execution are not confused.
- [ ] Logging stays project-local in the explanation or workflow.
- [ ] Cross-project context leakage is not normalized.
