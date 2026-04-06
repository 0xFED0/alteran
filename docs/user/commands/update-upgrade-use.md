# Update, Upgrade, And Use

These commands sound similar, but they change different things.

## Commands

```sh
alteran update [extra deno outdated flags...]
alteran upgrade [--alteran[=version]] [--deno[=version]]
alteran use --deno=<version>
```

## `update`

`alteran update` is dependency-update flow for the current project. Think
normal Deno dependency maintenance, not Alteran runtime policy.

## `upgrade`

`alteran upgrade` upgrades installed runtime material.

- `--alteran` refreshes the Alteran runtime material
- `--deno` upgrades the installed managed Deno runtime

This command is about installed tooling, not desired project policy.

## `use`

`alteran use --deno=<version>` changes project configuration for the desired
managed Deno version, then refreshes the project.

## Practical Difference

- `update`: dependencies
- `upgrade`: installed runtime material
- `use`: desired Deno version policy in project config

## Related Reference

- [alteran.json reference](../../reference/alteran-json.md)
- [CLI reference](../../reference/cli.md)

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Clean And Compact](./clean.md)
- Next: [Bootstrap An Empty Project](../guides/bootstrap-empty-project.md)
