# Spec #3047: bacteria-game-remote is over its allScript warning budget on main

Issue: [#3047](https://github.com/WolfSoko/wol-sok-mono/issues/3047). Found
while building [#2899](https://github.com/WolfSoko/wol-sok-mono/issues/2899)
([PR #3045](https://github.com/WolfSoko/wol-sok-mono/pull/3045)). Gate:
[ADR 0014](../adr/0014-performance-gates-in-ci.md), phase 1.

## Goal

`bacteria-game-remote:build-federation:production` builds on `main` without a
budget warning, and the baselines say what the game ships today, so the next
growth warns again at +5%.

## What grew

Measured on 2026-11-12 by building the baseline's commit
(`289b3f7`, [#2698](https://github.com/WolfSoko/wol-sok-mono/pull/2698), 2026-10-26)
and `main` (`50a6dca`) with the same `node_modules`, and attributing every
byte of `main-*`, `polyfills-*` and `chunk-*` to its source through the
source maps:

| Budget      | Baseline | Warning at | `main` today                             |
| ----------- | -------- | ---------- | ---------------------------------------- |
| `allScript` | 1768 kB  | 1856.4 kB  | 1862.6 kB (+5.4%), **warns**             |
| `anyScript` | 622 kB   | 653.1 kB   | 652.1 kB (+4.8%), 1 kB below the warning |
| `initial`   | 227 kB   | 249.7 kB   | 228.5 kB (+0.7%)                         |

Where the ~95 kB came from (raw bytes, rounded):

- **Privacy policy** (`apps/bacteria-game-remote/src/app/privacy`): +19 kB,
  sections for analytics, the ad network port, ImprovMX, the command
  documents and the progress journal ([#2727](https://github.com/WolfSoko/wol-sok-mono/issues/2727), [#2729](https://github.com/WolfSoko/wol-sok-mono/issues/2729), [#2734](https://github.com/WolfSoko/wol-sok-mono/issues/2734), [#2802](https://github.com/WolfSoko/wol-sok-mono/issues/2802), [#2825](https://github.com/WolfSoko/wol-sok-mono/issues/2825),
  [#3043](https://github.com/WolfSoko/wol-sok-mono/issues/3043)). A lazy chunk of its own, only loaded on `/privacy`.
- **Opt-in usage statistics** ([#2729](https://github.com/WolfSoko/wol-sok-mono/issues/2729)): `libs/shared/analytics` +4 kB, the
  game's `analytics/` +6 kB and `@firebase/installations` +8 kB, a chunk the
  federation's shared `firebase/analytics` and `firebase/remote-config`
  bundles import, so it counts towards the remote's scripts.
- **Replays and the replay viewer** (`replays/`, ADR 0011): +13 kB.
- **The game lib's new parts** (`stage/`, `flow/`, `hud/`, `busy/`,
  `settings/`), +40 kB, partly moved out of `bacteria-game.component.ts`
  (−25 kB) and the old lib root, so net about +16 kB; `arena/` +9 kB,
  `menu/` +6 kB, `storage/`, `net/`, `support/` +8 kB together.
- **Engine** (`feat-shared-bacteria-engine`, moved out of the game lib):
  about +10 kB of new rules (`grid/`, `bot-senses`, `match-run`,
  `match-recorder`, `cloud-records`).

No duplicate, no stray dependency and no test code: every item is a shipped
feature. The one oddity, `@firebase/util`/`@firebase/app` code inside a
chunk of the remote (47 kB), was there at the baseline already.

## Non-goals

- No trimming of the privacy policy's text or the features above: they are
  wanted, and the policy must say what the game does.
- No change to the warning or error percentages, nor to other apps'
  budgets.
- No restructuring of the federation's shared Firebase bundles (the
  `@firebase/installations` chunk): it is how Native Federation splits shared
  packages; a change there is its own issue if wanted.

## Decisions

- **Raise the baselines deliberately**, as ADR 0014 allows for wanted
  growth, in a commit of its own,
  `perf(bacteria-game-remote): raise the allScript and anyScript baselines to what ships`.
  Trimming 6 kB would not be a fix: the growth is features, and the next
  feature would warn again.
- **`allScript` 1768 kB → 1863 kB, `anyScript` 622 kB → 653 kB**, the
  measured sizes rounded up to the next kB. `anyScript` goes too because it
  is 1 kB from its warning and grew by the same features; leaving it would
  make the next small game PR warn for the same reason.
- **`initial` stays at 227 kB**: it is +0.7%, far from its warning.

## Acceptance

1. `npx nx run bacteria-game-remote:build-federation:production` prints no
   `exceeded maximum budget` warning for `total scripts` nor for any single
   script.
2. `apps/bacteria-game-remote/project.json` holds `allScript` 1863 kB and
   `anyScript` 653 kB, the percentages unchanged.
3. The change is one `perf(bacteria-game-remote): ...` commit; the PR body
   says what grew, by how much and why (the table above).
4. `npx nx run bacteria-game-remote:build:production` (the full build,
   with `check-lazy-admin.mjs`) succeeds.

## Open questions

None.
