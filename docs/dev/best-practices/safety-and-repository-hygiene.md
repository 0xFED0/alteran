# Safety And Repository Hygiene

## Default To Non-Destructive Change

Alteran is sensitive to broad regressions because one change can affect:

- bootstrap
- activation
- runtime materialization
- generated scripts
- config sync
- examples
- docs
- publication

Prefer changes that preserve user state and repository state unless destruction is explicitly part of the intended behavior.

## Know What Kind Of File You Are Touching

Every important file should fall into one clear bucket:

- authored source
- generated local artifact
- generated but intentionally committed surface
- publication artifact
- test/example fixture

If ownership is fuzzy, stop and clarify before editing.

## Generated Does Not Mean Unimportant

Generated files can still be product-facing:

- `setup` / `setup.bat`
- `activate` / `activate.bat`
- app launchers
- synced config fragments
- checked-in example bootstrap scripts

Do not assume "generated" means safe to break.

## Fix The Generator, Not Just The Output

When the same fix would have to be repeated across generated outputs:

1. fix the generator/template
2. regenerate or resync committed outputs
3. rerun the affected flows

Manual spot-fixes to generated artifacts usually create drift.

## Keep Tracked Bootstrap Files Deliberate

Tracked bootstrap files are part of the product story:

- root `setup` / `setup.bat`
- app-local `setup` / `setup.bat` where the contract says they are public

Do not treat them as junk just because other generated files are ignored.

## Keep Generated Local State Out Of Git By Default

As a rule:

- `.runtime/` should be ignored
- generated activation should be ignored
- generated app launchers should be ignored
- versioned publication output should be ignored unless intentionally staged

But do not over-apply ignore rules to public bootstrap surfaces that are meant to stay tracked.

## Keep The Repository Honest

Do not make the repository look cleaner by hiding real distinctions.

Examples:

- `src/` is authored source
- `.runtime/` is generated local state
- root `setup` is a public bootstrap file
- root `activate` is a generated local artifact
- examples may intentionally commit generated bootstrap surfaces as docs/product fixtures

That asymmetry is healthy when it is honest and documented.

## Keep Examples And Docs Clean Too

Examples and docs should not accumulate:

- stale generated files
- stale copied outputs
- stale release artifacts
- hidden dependency on developer-local state

If an example is checked in, it should either be canonical or clearly marked as fixture-like.

## Prefer Additive Migration Before Hard Removal

If a model evolves:

- add the new path first
- migrate behavior carefully
- keep backward compatibility where practical
- remove the old path only after docs, tests, and generators are aligned

This is safer than abrupt "hard switch" refactors in a bootstrap-heavy system.

## Do Not Create Split-Brain Trees

Avoid reviving or creating competing roots such as:

- hidden legacy spec trees
- parallel docs trees with different truth claims
- second config locations for the same concept

If a new directory exists, its responsibility should be explicit.

## Practical Smells

- a tracked file is supposed to be ignored
- an ignored file is expected to be downloaded or committed by users
- a change edits committed outputs but not the generator
- the repo root starts accumulating stray artifacts after normal development
- examples or docs rely on developer-local leftovers
- two different locations both claim to be the source of truth

## Related Source Of Truth

- [Repository Layout](../repository-layout.md)
- [Generated Files](../generated-files.md)
- [Design Rules](../design-rules.md)
