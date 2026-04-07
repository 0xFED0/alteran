# Generated Files

Alteran intentionally generates and regenerates several files so users do not have to maintain fragile shell and sync artifacts manually.

## Project-Level Generated Files

- `activate`
- `activate.bat`
- `alteran.json` defaults
- synchronized parts of `deno.json`
- managed `.gitignore` block

`setup` and `setup.bat` are public bootstrap files, but they are also generated from Alteran-owned templates.

That means contributors should normally fix the generator/template first, then resync the committed bootstrap files.

## App-Level Generated Files

Managed apps receive local helper scripts such as:

- `setup`
- `setup.bat`
- `app`
- `app.bat`

Within that set:

- `setup` / `setup.bat` are app-local bootstrap files
- `app` / `app.bat` are generated launchers

The launchers are generated local surfaces and should be treated as such. The setup files are also Alteran-generated, but they belong to the app bootstrap contract rather than to the app's authored source tree.

In other words:

- tracked bootstrap surfaces may still be generated
- generated local launchers do not automatically become tracked product files

## Publication-Generated Files

Publication tooling generates staged output under:

- `dist/jsr/<version>/`
- `dist/zips/<version>/`

## Design Intent

Generated files should be:

- reproducible
- owned by Alteran templates or sync logic
- safe to regenerate

Generated does not mean unimportant. Some generated files are part of the public product story and should be treated with the same care as authored source.

## Navigation
- Home: [Docs Index](../README.md)
- Previous: [Config Sync](./config-sync.md)
- Next: [Managed Execution](./managed-execution.md)
