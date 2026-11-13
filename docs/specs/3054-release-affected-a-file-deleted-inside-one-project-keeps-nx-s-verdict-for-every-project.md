# Spec #3054: release-affected: a file deleted inside one project keeps Nx's verdict for every project

Issue: [#3054](https://github.com/WolfSoko/wol-sok-mono/issues/3054). Found on
[PR #3044](https://github.com/WolfSoko/wol-sok-mono/pull/3044)
([#3020](https://github.com/WolfSoko/wol-sok-mono/issues/3020)):
[#3029](https://github.com/WolfSoko/wol-sok-mono/pull/3029) deleted
`libs/public/nx-aws-cdk-v2/src/utils/testing.ts`.

## Problem

`tools/ci/release-affected.mjs` keeps Nx's verdict for every candidate as
soon as any file was deleted (`nxVerdictReason`): a deleted file is in no
input set resolved at the head, so the filter could not judge it
([#2888](https://github.com/WolfSoko/wol-sok-mono/issues/2888)'s spec chose
this on purpose). Nx calls every project affected whose input globs would
have matched the file, and more: all three published packages for #3029's
deletion. So that release bumped and published `spa-cdk-stack` and
`ws-thanos` too, and every deploy leg redeploys whatever Nx calls affected.
The script runs in `deploy.yml`, `ci-cd.yml`'s release trigger and
`release.yml`'s version step, so all three over-select.

## Goal

A file deleted inside a project counts only for the candidates that read
that project's files; Nx's verdict stays only where the script cannot place
the deletion.

## Non-goals

- Matching a deletion against each task's own input globs (`production`
  excluding specs, say). The resolved input sets name files, not globs, so a
  deleted spec still counts for a candidate reading its project's sources.
  That over-selects a little. It under-selects only where a candidate's glob
  reached into the owner for the deleted files alone and nothing else in the
  range changed (say all of `tools/version-handling/**` deleted with no edit
  to the command reading it): the change that stops using such files keeps
  the candidate in practice.
- Changing how renames, root files or `tsconfig.base.json` count.

## Decisions

- **Owner by longest root prefix.** A deleted file belongs to the project
  whose root (from the project graph at the head) is the longest prefix of
  its path ending at a `/`: `tools/federation/x.js` is `tools-federation`'s,
  not `tools`'. The root project `wolsok` (root `.`) owns nothing, else every
  file would have an owner.
- **A deletion counts for a candidate reading a file under its owner's
  root.** The candidate's resolved inputs (its task and the tasks it depends
  on, as today) list the owner's remaining files exactly where its globs
  reach into the owner, which is what the issue's `{projectRoot}/**` stands
  for. The reason reads `reads <root>/, where <file> was deleted`.
- **Nx's verdict stays for a deletion without an owner**: a file at the
  workspace root or outside every project, or one of a project gone at the
  head (a whole lib deleted, so no root at the head holds it). A deleted
  `project.json` keeps it too: the roots come from the head, so the files of
  a removed nested project (`tools/vite`) would fall to the enclosing root
  (`tools`), which its readers need not read. Conservative, as before.
- **The project roots are read only when something was deleted**, through
  one `nx graph --file=<tmp>.json`; a failing read keeps Nx's verdict, as a
  failing input read does today.
- The pure `selectReleaseAffected` takes the roots as `projectRoots`
  (project to root), so its specs need no Nx.

## Acceptance

1. A file deleted under a project's root keeps only the candidates whose
   inputs hold a file under that root; the others are dropped unless a
   changed file keeps them.
2. A file deleted outside every project root (or under `.` only) keeps Nx's
   verdict for every candidate.
3. The longest root wins (`tools/federation/…` is not `tools`').
4. A failed read of the roots keeps Nx's verdict.
5. #3029's deletion beside the lint-only configs, as #3044's dry run had
   it (`--files=libs/public/nx-aws-cdk-v2/src/utils/testing.ts,.oxlintrc.json,eslint.config.mjs
   --target=build --projects=tag:published`), selects `nx-aws-cdk-v2` only
   (all three packages before). Over #3029 alone (`--base=95f38a8^
   --head=95f38a8`) Nx already names only `nx-aws-cdk-v2`: the deletion
   hurt only by stopping the filter for the other changes of a range.
6. `npx nx test tools`, lint and format pass; CLAUDE.md's "What a release
   deploys" says how a deletion counts.

## Open questions

None.
