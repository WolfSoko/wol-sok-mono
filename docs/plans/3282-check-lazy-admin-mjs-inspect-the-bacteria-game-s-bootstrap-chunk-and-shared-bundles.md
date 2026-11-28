# Plan: check-lazy-admin.mjs: inspect the bacteria game's bootstrap chunk and shared bundles ([#3282](https://github.com/WolfSoko/wol-sok-mono/issues/3282))

Spec: `docs/specs/3282-check-lazy-admin-mjs-inspect-the-bacteria-game-s-bootstrap-chunk-and-shared-bundles.md`.
Built on #3278's branch (PR #3283); rebased onto `main` once that merged.

## 1. Spec of the check, red

- `tools/bacteria-game/check-lazy-admin.test.mjs` (new): fixture dists from
  `tools/build-checks/dist-fixture.mjs`, with a `remoteEntry.json`; cases:
  - admin source in the chunk `main-M.js` loads by `import()` → 1, the
    message names `chunk-B.js: …bacteria-wars-admin/…`;
  - admin source in a shared bundle the bootstrap chunk imports by bare
    specifier → 1;
  - admin only behind a dynamic import of the bootstrap chunk → 0, the
    message lists every inspected script;
  - admin in a chunk `Routes-R.js` imports → 1 (kept from today);
  - no script names `apps/bacteria-game-remote/src/bootstrap.ts` → 2;
  - no source map → 2 (kept from today).
- Run `npx nx test tools`: the new cases fail (no `checkLazyAdmin` export).

## 2. The check, green

- `tools/bacteria-game/check-lazy-admin.mjs`: export `checkLazyAdmin(dist)`
  returning the exit code; `followShared` and `crossMainBoundary` on; the
  bootstrap guard; the success line lists the scripts; CLI only when run as
  the entry.
- Run `npx nx test tools`, `npx nx lint tools`, `npx nx run
  tools:typecheck-tools`.

## 3. Docs

- `CLAUDE.md`, Native Federation, admin bullet: what the check inspects.
- Commit 1–3 together: `fix(tools): check-lazy-admin inspects the game's
  bootstrap chunk and shared bundles` (spec, plan, check, spec file, docs).

## 4. Verify on the real build

- `npx nx run bacteria-game-remote:build:production`: green, the log lists
  the scripts, among them the bootstrap chunk.
- Add `import '@wolsok/feat-lazy-bac-wars-admin';` (or a symbol import) to
  `app.config.ts`, build again: exit 1 naming the script; revert.
- Results into the PR description.
