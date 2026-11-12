# Spec #2955: tools test target runs every `tools/**/*.test.mjs`

Issue: [#2955](https://github.com/WolfSoko/wol-sok-mono/issues/2955), found in
the review of [PR #2951](https://github.com/WolfSoko/wol-sok-mono/pull/2951)
([#2935](https://github.com/WolfSoko/wol-sok-mono/issues/2935)). Related:
[#2950](https://github.com/WolfSoko/wol-sok-mono/issues/2950).

## Goal

`tools/firebase/grant-admin.test.mjs` (12 `node:test` tests of
`grant-admin.mjs`) runs in no target, so CI never checks it. The project
`tools` already has a `test` target, but its command runs only
`tools/ci/*.test.mjs`. It becomes `node --test "tools/**/*.test.mjs"`, so
`nx affected -t test` runs every `*.test.mjs` under `tools/`, and a new one is
picked up without touching the target.

## Non-goals

- No change to the nested projects (`tools-deploy`, `tools-federation`,
  `tools-vite`, `oxlint-workspace-rules`): they keep their own `test` targets
  and name their specs `*.spec.*`, which the glob leaves alone.
- No new tests of `grant-admin.mjs`; the existing ones only start running.

## Decisions

- **One glob, not one target per folder.** Node's test runner expands
  `tools/**/*.test.mjs` itself (Node 24, `.nvmrc`) and skips `node_modules`,
  so the target needs no list of folders that would drift.
- **Inputs widen to `{workspaceRoot}/tools/**/*.mjs`** beside the existing
  `tools/ci/**/*` (whose fixtures are not `.mjs`): a test and the module it
  imports are both `.mjs` under `tools/`, so a change to either reruns the
  target, while the cache still holds for edits elsewhere.
- **`CLAUDE.md`** says `npx nx test tools` runs every `tools/**/*.test.mjs`,
  and the test file's header names the target instead of a bare `node --test`.

## Acceptance

1. `npx nx test tools --skip-nx-cache` runs `grant-admin.test.mjs` (its
   suites `parseArgs` and `nextClaims` show in the output) beside the
   `tools/ci` tests, and passes.
2. `npx nx show project tools --json` lists `{workspaceRoot}/tools/**/*.mjs`
   among the `test` inputs, so a change to `tools/firebase/grant-admin.mjs`
   makes `tools:test` affected and uncached.
3. A deliberately broken assertion in `grant-admin.test.mjs` turns
   `nx test tools` red (checked locally, not committed).
4. `npx nx test tools` (which includes `target-inputs.test.mjs`, checking
   target inputs) and `npx nx lint tools` pass.

## Open questions

None.
