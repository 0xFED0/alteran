# Skill: Bootstrap And Entry

## Use When

- setting up a new Alteran project
- repairing a project after runtime drift or relocation
- entering the local environment correctly

## Steps

1. Use `setup` as the bootstrap and repair command.
2. Enter the environment through `activate`.
3. On Unix, use `source ./activate`.
4. Treat `activate` as a local entry helper, not as the place for repair or
   download logic.
5. If entry or runtime state looks stale after moving the project, rerun
   `setup`.

## Done Checklist

- [ ] The project has a valid local runtime layout.
- [ ] Entry uses `activate` correctly for the current shell.
- [ ] No workflow depends on reviving `init`.
