# Federation: guard that every singleton a remote shares is also in the shell's import map

Issue: [#3085](https://github.com/WolfSoko/wol-sok-mono/issues/3085)

## Goal

`tools/federation/workspace-federation.js` turns on `features.ignoreUnusedDeps`, which prunes each app's shared entries to what that app imports. When a remote shares a singleton entry the shell (`angular-examples`) does not, the shell has no copy to give it, so inside the shell the remote loads its own bundle of that package: for a `firebase/*` entry together with its own `@nf-internal/chunk-*` holding `@firebase/app`, a second Firebase component registry beside the shell's. Today the shell shares every singleton the three remotes share, at the same version (checked on the production builds of 2026-11-16: no gap), but nothing keeps it so. A check after the federation builds now fails CI when a remote shares a singleton entry the shell lacks, or shares it at another version.

## Non-goals

- No change to `workspace-federation.js` or to what any app shares: the check only reports (touching that file redeploys all four federation apps).
- No check of the deployed remotes against the deployed shell (a remote released without the shell): the check compares builds of one commit.
- No check of the `@nf-internal/*` chunks themselves: they are not singletons and belong to the bundles that import them (#3063).

## Decisions

- **All singleton entries, not only `firebase/*`.** Any singleton the shell lacks gets a second copy inside the shell (Angular, CDK, RxJS hold state the same way), and today none is missing, so the broader rule costs nothing. Non-singleton entries (`p5`, the `@nf-internal/*` chunks) are left out.
- **Compare `remoteEntry.json`**, not `importmap.json`: it lists each shared entry with `packageName`, `singleton` and `version`, which the rule needs; the import map has only URLs.
- **The remotes come from the shell's production manifest** (`apps/angular-examples/src/assets/federation.manifest.prod.json`, its keys are the remote project names), each read from `dist/apps/<name>/remoteEntry.json`, so a new remote is checked without editing the script.
- **A project of its own**, `federation-shared-singletons` in `tools/federation/shared-singletons/` (tag `tools`), with `implicitDependencies` on the shell and the three remotes, so `nx affected` runs it whenever one of them changes. It reads only their build output and imports none of their code. It has no `deploy` target, so releases ignore it.
- **Its `test` target runs it**, so CI's existing `nx affected -t …,test,…` call runs it with no workflow change: first the unit specs (`node --test`), then the check (`node tools/federation/shared-singletons/check-shared-singletons.mjs`). It depends on `^build` and on `bacteria-game-remote:build-federation` (whose output holds that remote's `remoteEntry.json`; the remote's `build` only adds `ngsw.json`). It is cached on its own files, the manifest and the `remoteEntry.json` files of the builds it depends on, so it reruns only when a shared entry changes.
- **The rule is a pure function**, `missingSingletons(shell, remotes)` in `shared-singletons.mjs`, returning one finding per remote and entry (name, the remote's version, the shell's version or none). The script prints each finding as `::error::` and exits 1; a missing `remoteEntry.json` fails too, naming the file.
- **A spec keeps the project's `implicitDependencies`** equal to the shell plus the manifest's remotes, so a new remote cannot be left out of `nx affected`.
- CLAUDE.md's Native Federation section gets one bullet on the check.

## Acceptance

1. `missingSingletons` reports a remote's singleton entry the shell lacks, and one the shell shares at another version; it reports nothing for a non-singleton entry, for an entry the shell shares at the same version, or for remotes that share nothing (specs).
2. The project's `implicitDependencies` equal `angular-examples` plus the keys of the prod manifest (spec).
3. `npx nx test federation-shared-singletons` passes on the current builds of the four apps.
4. Run on a shell `remoteEntry.json` with `firebase/firestore` removed, the check fails and names `bacteria-game-remote` and `firebase/firestore` (manual, noted in the PR).
5. `nx show project federation-shared-singletons` lists the target, and `nx affected` with a change in a remote includes it (manual, noted in the PR).

## Open questions

None.
