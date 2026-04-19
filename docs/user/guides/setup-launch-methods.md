# Setup Launch Methods

This guide is the canonical user-facing reference for the different ways to run
`setup`.

Use it when you already understand that `setup` is the bootstrap and repair
surface, but need to choose the right entry path for your machine or workflow.

## Recommended Default On Unix

The shortest public bootstrap path is the versioned release script:

```sh
mkdir hello-alteran
cd hello-alteran
curl -fsSL https://github.com/0xFED0/alteran/releases/download/v0.1.10/setup-v0.1.10 | sh -s -- .
source ./activate
```

This is the simplest path because it does not require a global Deno install
up front.

## Keep A Local `setup` File In The Project

If you want the project directory itself to keep a local bootstrap file:

```sh
curl -fsSLo setup https://github.com/0xFED0/alteran/releases/download/v0.1.10/setup-v0.1.10
chmod +x ./setup
./setup
source ./activate
```

This is often the most practical path when you want the project folder to stay
portable and self-bootstrapping after the first download.

## Windows `cmd`

Download the versioned batch bootstrap file and run it in the target project
directory:

```bat
curl.exe -fsSLo setup.bat https://github.com/0xFED0/alteran/releases/download/v0.1.10/setup-v0.1.10.bat
call setup.bat
call activate.bat
```

This is the direct Windows equivalent of keeping a local public bootstrap file
in the project.

## Windows PowerShell `iex`

If you want the one-shot PowerShell path, use the versioned release wrapper:

```powershell
irm https://github.com/0xFED0/alteran/releases/download/v0.1.10/setup-v0.1.10.ps1 | iex
. .\activate.ps1
```

This PowerShell wrapper is only a release convenience surface. It does not
replace `setup.bat`; it writes `setup.bat` into the project and then delegates
bootstrap through `cmd`.

## Deno Public Package Entry

If Deno is already installed globally, the public package entry remains a valid
path:

```sh
deno run -A jsr:@alteran/alteran setup
source ./activate
```

Use this when Deno is already present and you want a package-oriented entry
instead of downloading a release script first.

## From An Existing Alteran Checkout

If you already have a local Alteran repository checkout, you can bootstrap
another directory directly:

```sh
./setup ./some-project
source ./some-project/activate
```

That path is useful for repository-local development and for bootstrapping a
different target directory from an existing checkout.

## Which Path To Pick

- use `curl ... | sh` on Unix when you want the shortest public bootstrap path
- use downloaded `setup` / `setup.bat` when you want local bootstrap files in
  the project
- use `irm ... | iex` in PowerShell when you want the shortest native
  PowerShell bootstrap path without maintaining a separate Windows bootstrap
  implementation
- use `deno run -A jsr:@alteran/alteran setup` when Deno is already installed
- use `./setup <dir>` when you already have an Alteran checkout and want to
  bootstrap another directory

## Related Docs

- [Quickstart](../quickstart.md)
- [Project Setup Command](../commands/setup.md)
- [Bootstrap An Empty Project](./bootstrap-empty-project.md)

## Navigation
- Home: [Docs Index](../../README.md)
- Previous: [Bootstrap An Empty Project](./bootstrap-empty-project.md)
- Next: [Working With Apps](./working-with-apps.md)
