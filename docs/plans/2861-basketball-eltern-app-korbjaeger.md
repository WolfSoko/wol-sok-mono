# Plan: Basketball-Eltern-App (Korbjäger)

Spec: [docs/specs/2861-basketball-eltern-app-korbjaeger.md](../specs/2861-basketball-eltern-app-korbjaeger.md). Issue: [#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861).

Six PRs, in order, each green on its own and merged through its own merge request. The Firebase project id and the domain each live in one place (`.firebaserc` and one app config value), since the owner picks the final project id. Every task is test first and ends in one commit. Before every commit: `npx nx format:write`, `npx nx affected -t lint,lint-templates,test`.

## PR 1 — Domain lib and DBB adapter (`Refs #2861`)

1. **Scaffold the lib** — `nx g @nx/js:lib` at `libs/features/basketball-data` (Jest, tag `feat-shared`, path alias `@wolsok/feat-shared-basketball-data`), `typecheck-specs` target. Commit `feat(feat-shared-basketball-data): add the lib`.
2. **Record and anonymise fixtures** — `tools/korbjaeger/record-fixtures.ts` fetches the eight endpoints for a chosen Bavarian youth Liga (Spielerwerte), a Schleswig-Holstein one (roster only), a Team with Vorrunde + Hauptrunde, a cancelled and a forfeited Spiel; `anonymise-fixtures.ts` replaces names and person ids deterministically; spec: no input name survives. Fixtures under `src/lib/dbb/fixtures/`. Commit `feat(feat-shared-basketball-data): record anonymised DBB fixtures`.
3. **Domain types and errors** — `src/lib/domain/*.ts` (Verband, Liga, Saison, Verein, Team, Spiel, Spielbericht, KaderEintrag = BenannterSpieler | AnonymerSpieler, Spielerwerte, TabellenZeile, Halle), `BasketballDataError` with `kind`. Commit `feat(...): add the domain types`.
4. **Envelope** — `dbb/envelope.ts`: `status` `0`/`1`/`-1` → data / not-found / unavailable, wrong shape → unexpected-shape. Spec first. Commit.
5. **Mappers, one per endpoint** — `dbb/map-*.ts` with specs on the fixtures: Liga search + paging, Liga teams, Verein teams, team matches merged across Ligen, Tabelle, matchInfo (score, quarters, Halle, cancelled/forfeited, moved), boxscore (Kader, Anonyme Spieler, all-zero → not recorded). One commit per mapper.
6. **`BasketballData` port and `DbbBasketballData` adapter** — over an injected `DbbTransport` that takes one allowlisted `DbbRequest` (`dbbHttpRequest` maps it to method, path and body, for the proxy to reuse); `ligaSeite` pages the Liga list; spec with a fake transport. Commit.
7. **ADRs 0018 and 0019**; they refer to the glossary of [#2860](https://github.com/WolfSoko/wol-sok-mono/pull/2860) without copying it. Commit `docs(...)`.

## PR 2 — App shell and proxy (`Refs #2861`)

1. **Scaffold `apps/korbjaeger`** like `rollapolla-analog` (Analog, Vitest, Nitro `firebase` preset, client-only pages), Material theme, self-hosted fonts and icons, selector prefix `korb` in `eslint.config.mjs`, `typecheck-specs`. Commit `feat(korbjaeger): add the app shell`.
2. **Proxy core** — `src/server/dbb/upstream.ts` (base URL from env `DBB_BASE_URL`, 5 s timeout, User-Agent, no cookies, maps envelope status to 404/502) and `cache-headers.ts`; specs with a faked fetch. Commit.
3. **Proxy routes** — `src/server/routes/api/dbb/**` one file per allowlisted read, numeric id validation, the Liga search as GET → POST body; route specs (allowlist, 404, headers, 502, cookies). Commit.
4. **Client transport** — `ProxyBasketballData` provider wiring the lib's adapter to `/api/dbb/`, plus the last-good-response cache with age. Spec. Commit.
5. **Indexing** — `noindex` meta, `robots.txt`, Hosting header in `firebase.korbjaeger.json`, README (no sitemap and why). Commit.

## PR 3 — Auswahl and account (`Refs #2861`)

1. **`Auswahl` port + local adapter** with the shared contract suite. Commit.
2. **Firestore adapter** + contract suite against the emulator; `firestore.rules`, `rules-test` (`test-emulator` target) for owner only, field allowlist, caps, delete. Commit.
3. **`AccountPort` + Google adapter**, first-sign-in merge spec, delete account. Commit.

## PR 4 — Screens (`Refs #2861`)

One commit each, component specs against fake `BasketballData`/`Auswahl`:

1. Team einrichten (Verband → age group → Liga → Team, Verein's other Teams).
2. Team page (Spiele across Ligen, home/away, Halle + navigation link, Tabelle per Liga with highlight).
3. Spiel page (score, quarters, both Kader, Kind highlight, Spielerwerte / "keine Spielerwerte erfasst" / "noch kein Spielbericht").
4. Kind markieren (from a played Spiel's Kader, nickname, unmark, Anonyme Spieler disabled, hint before the first Spiel).
5. Overview (Kinder sorted by next Spiel, last result + Kader flag, Teams without Kind, cancelled/moved, season-end hint).
6. Settings (sign in/out, delete account), DBB source and lag note, offline/age and DBB-unreachable messages.

## PR 5 — PWA, legal, E2E (`Refs #2861`)

1. Manifest, icons, service worker (shell only). Commit.
2. `/privacy` and `/impressum` with `SITE_OWNER`. Commit.
3. Fake DBB server (`e2e/fake-dbb/`, serving the fixtures) as a continuous Nx target; Playwright flow set up Team → mark Kind → overview. Commit.

## PR 6 — Deploy (`Closes #2861`)

Stays unmerged until the owner has created the Firebase project, Google provider, Hosting site, CI deploy credentials and DNS; the PR lists every secret name and setting it expects.

1. `deploy` target, `firebase.korbjaeger.json` `predeploy` with `--legacy-peer-deps=false`, `firebase-deploy.spec.ts`, `.firebaserc` entry. Commit.
2. `apps/korbjaeger-cdk` (extends `tsconfig.cdk.json`) with the `korb.wolsok.de` CNAME. Commit.
3. `deploy.yml` `non-cdk` leg runs it when affected; CLAUDE.md section on the app. Commit.
