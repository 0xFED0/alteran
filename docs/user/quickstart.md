# Quickstart

This page expands the front-page README quick start without turning into a full reference manual. The goal is to get you from an empty directory to a working app and tool as quickly as possible, while still explaining what happened.

One big thing to keep in mind while reading: Alteran is designed around portable project folders. The same project can be copied to another machine, and `setup` can restore the local runtime there.

## 1. Create A Project Directory

```sh
mkdir hello-alteran
cd hello-alteran
```

## 2. Bootstrap The Project

The intended public package path is:

```sh
deno run -A jsr:@alteran setup
```

That path is great when Deno is already available on the machine.

## 3. Enter The Local Environment

On Unix-like shells:

```sh
source ./activate
```

On Windows `cmd`:

```bat
call activate.bat
```

Activation makes the project-local `deno` and `alteran` available in the current shell session. In other words, after this step you are working inside the project's own managed environment rather than depending on a global setup.

## 4. Create An App And A Tool

```sh
alteran app add hello
alteran tool add seed
```

This creates scaffolded project units under `apps/hello/` and `tools/`. The app is a runnable project unit. The tool is a reusable automation command that lives alongside your project code.

## 5. Replace The Generated App Code

Edit `apps/hello/core/mod.ts`:

```ts
export async function main(args: string[]): Promise<void> {
  console.log("hello app", {
    args,
    managed: Deno.env.get("ALTERAN_HOME") !== undefined,
  });
}

if (import.meta.main) {
  await main(Deno.args);
}
```

## 6. Replace The Generated Tool Code

Edit `tools/seed/mod.ts`:

```ts
export async function main(args: string[]): Promise<void> {
  console.log("seed tool", { args });
}
```

The generated `tools/seed.ts` entrypoint already delegates to this helper module, so editing `mod.ts` is enough for the first pass.

## 7. Run Both

```sh
alteran app run hello
alteran tool run seed demo
```

## 8. What You Should See

- the project now has `alteran.json`, `deno.json`, `apps/`, `tools/`, `libs/`, `tests/`, and `.runtime/`
- `activate` or `activate.bat` was generated locally
- `alteran app run hello` runs the app task from `apps/hello/deno.json`
- `alteran tool run seed demo` runs the tool through Alteran-managed Deno
- `ALTERAN_HOME` is set during managed execution
- the app and the tool are created differently, but both become first-class parts of the same project
- the project now has its own local bootstrap and runtime story, which is what makes the folder portable

## 9. High-Level Project Shape

```text
hello-alteran/
  setup
  setup.bat
  activate
  activate.bat
  alteran.json
  deno.json
  apps/
    hello/
  tools/
    seed.ts
    seed/
      mod.ts
  libs/
  tests/
  .runtime/
```

## 10. What Happened Conceptually

- `setup` materialized project structure, bootstrap files, config, runtime material, and a managed Deno installation
- `activate` pointed your shell at the local runtime and exposed the `alteran` command
- `app add` and `tool add` scaffolded real project units and updated project config
- `app run` and `tool run` executed inside the Alteran-managed environment
- plain Deno is still available, but Alteran now gives you a project-specific execution path with its own context and logging

## 11. Why Local Runtime Matters

The local runtime is not just an implementation detail. It is what makes an Alteran project portable.

A typical flow looks like this:

1. create the project on one machine
2. copy the whole folder to a USB drive, network share, or another computer
3. run `setup` there
4. keep working in the same project layout and commands

That is the main reason Alteran prefers project-local runtime material over assuming one global installation shared by every project on the machine.

## 12. Alternative Bootstrap When Deno Is Not Installed Yet

If the machine does not already have Deno, the checked-in `setup` script is the important fallback.

Typical options are:

1. download `setup` from this repository into the target directory and run it there;
2. use a checked-out Alteran repository copy and bootstrap another directory with `./setup <dir>`.

Repository-local example:

```sh
./setup ./some-project
source ./some-project/activate
```

That path is not only for developing the Alteran repository itself. It is also part of the practical bootstrap story for real projects on machines where Deno is not available yet.

## Next Reading

- [Concepts](./concepts.md)
- [Project Layout](./project-layout.md)
- [Activation](./activation.md)
- [Commands Overview](./commands/overview.md)
- [Examples](../../examples/README.md)

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Getting Started](./getting-started.md)
- Next: [Concepts](./concepts.md)
