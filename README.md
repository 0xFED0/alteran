# Alteran

Alteran is a project-local runtime and scaffold manager for portable Deno projects.

It gives a project its own bootstrap entrypoints, managed Deno runtime, structured `apps/`, `tools/`, `libs/`, and `tests/` layout, and a clear split between authored source and recoverable local runtime state.

## Why Alteran

- bootstrap a project from an empty or near-empty directory
- bootstrap an existing project even on a machine that does not already have Deno installed
- keep Deno local to the project instead of depending on a global install
- make the whole project folder portable between machines: copy it, send it, rerun `setup`, and keep working
- manage apps and tools as first-class project units
- regenerate runtime state, activation files, and config instead of treating them as hand-maintained shell plumbing
- keep plain Deno available while adding an Alteran-managed execution mode

One of Alteran's biggest practical advantages is that the project owns its runtime story. You can create a project, copy the folder to another machine or send it over the network, run `setup`, and get back to a working local environment without depending on a preinstalled global Deno toolchain.

## Quick Start

Create a project directory:

```sh
mkdir hello-alteran
cd hello-alteran
```

Initialize it from the intended public package entrypoint:

```sh
deno run -A jsr:@alteran/alteran setup
source ./activate
```

Create one app and one tool:

```sh
alteran app add hello
alteran tool add seed
```

Replace the generated app code in `apps/hello/core/mod.ts`:

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

Replace the generated tool code in `tools/seed/mod.ts`:

```ts
export async function main(args: string[]): Promise<void> {
  console.log("seed tool", { args });
}
```

Run both:

```sh
alteran app run hello
alteran tool run seed demo
```

This quick start shows the core Alteran story: bootstrap a project, enter its local environment, create an app and a tool, and run both through the project-managed runtime.

For a fuller walkthrough, see [docs/user/quickstart.md](./docs/user/quickstart.md).

## No Global Deno Yet?

If the target machine does not already have Deno installed, use the checked-in bootstrap script instead of the JSR command.

Two common paths are:

1. download `setup` from this repository into the target directory and run it there;
2. if you already have a checkout of this repository, run `./setup <dir>` to bootstrap another directory.

Repository-local example:

```sh
./setup ./some-project
source ./some-project/activate
```

This keeps the bootstrap story working even before any global Deno runtime is available on the machine.

## Portable Project Folders

One of Alteran's main selling points is that a project folder is meant to be portable.

A typical flow is:

1. create the project on one machine;
2. copy the folder to a USB drive, network share, or another computer;
3. run `setup` there;
4. continue using the same project layout and commands.

That is the main reason Alteran prefers a project-local runtime over assuming a single globally installed toolchain for every project.

## Working From This Repository

When you are developing Alteran from this source checkout, use the local repo bootstrap surface instead of the published package surface:

```sh
./setup
source ./activate
```

That same `./setup` pattern is not special to the Alteran repository itself. The script can also target another directory, including an empty one:

```sh
./setup ./some-project
source ./some-project/activate
```

That is the path to use when you want to bootstrap a project on a machine where `deno run -A jsr:@alteran/alteran setup` is not available because Deno is not yet installed globally.

In this repository, Alteran authored source lives under `src/alteran/`, `src/tools/`, and `src/libs/`. The local `.runtime/` tree is materialized runtime state.

On Unix-like hosts, the bootstrap and local test flows assume a small baseline of system tools:

- `curl`
- `unzip`
- `zip`
- `git`

`setup` itself needs either a working global `deno` or local `curl` + `unzip` so it can materialize a project-local Deno. The full local test suite additionally uses `zip` for deterministic local archive fixtures and `git` for clean tracked-file repository copy scenarios such as the README quick start test.

## Docs

- [Documentation index](./docs/README.md)
- [AI instructions](./AGENTS.md)
- [User docs](./docs/user/overview.md)
- [Developer docs](./docs/dev/overview.md)
- [Portable AI user bundle](./docs/ai-user/README.md)
- [AI dev docs](./docs/ai-dev/README.md)
- [Reference docs](./docs/reference/cli.md)
- [Examples](./examples/README.md)
- [Architecture decisions](./docs/dev/adr/index.md)
- [Main product spec](./docs/spec/001-alteran_spec.md)
- [Documentation spec](./docs/spec/005-alteran_documentation_spec.md)
