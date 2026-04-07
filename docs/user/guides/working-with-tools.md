# Working With Tools

Tools are managed automation units under `tools/`.

## Create One

```sh
alteran tool add seed
```

The default scaffold creates:

- `tools/seed.ts`
- `tools/seed/mod.ts`

## Run It

```sh
alteran tool run seed
```

Tools run through Alteran-managed Deno and participate in Alteran logging and
context propagation.

## Why Use Tools Instead Of A Scripts Folder

Tools keep project automation inside the same:

- runtime environment
- logging system
- config story
- repository structure

## Related Example

See [03-tools-workspace](../../../examples/03-tools-workspace/README.md).

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Working With Apps](./working-with-apps.md)
- Next: [Shared Libraries](./shared-libs.md)
