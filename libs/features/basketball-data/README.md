# feat-shared-basketball-data

The domain and data access of the basketball parents app (working title
Korbjäger, [#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861)).
Its terms (Verband, Liga, Saison, Verein, Team, Spiel, Spielbericht, Kader,
Spielerwerte, Anonymer Spieler, Halle, Kind) are the glossary's in
`CONTEXT.md`.

Node only: no Angular, Firebase, RxJS or DOM (an oxlint override and the
lib's `lib: ["ES2024"]` keep them out), so both the app and its server
routes use it. Import it as `@wolsok/feat-shared-basketball-data`; nothing
outside the lib imports a path inside it, with one exception: the fixture
tools in `tools/korbjaeger/` import `src/lib/dbb/dbb-request.ts`, the
domain's `liga-suche.ts` and the test-only `src/testing/` (the anonymiser,
`isOutsideFolder`) by relative path, as `tools/bacteria-game/balance` does
with the engine, since `src/testing/` has no path alias and tools are no
Nx project.

## What it holds

- **`BasketballData`**, the port the screens read: `ligaSuche`,
  `ligaSeite`, `ligaTeams`, `vereinsTeams`, `teamSpiele`, `tabelle`,
  `spiel`, `spielbericht`. All async, all in domain types, all rejecting
  with a `BasketballDataError` of kind `not-found`, `unavailable` or
  `unexpected-shape` only.
- **The domain types** (`src/lib/domain/`). Ids are the DBB's stable ones:
  a Team is its `teamPermanentId`, a Kind its `person.id`; the
  season-specific `seasonTeamId` stays in the adapter. A Kader entry is a
  `BenannterSpieler` or an `AnonymerSpieler`, which has no person id and so
  cannot be marked. Each Kader of a Spielbericht says whether its
  Spielerwerte were recorded (`spielerwerteErfasst`); one whose numbers are
  all 0 has `false` and no Spielerwerte, never zeros.
- **`DbbBasketballData`** (`src/lib/dbb/`), the adapter over the DBB's
  undocumented JSON API (ADR 0018). It takes a `DbbTransport`, a function
  that answers one allowlisted `DbbRequest` with the DBB's JSON;
  `dbbHttpRequest` turns a `DbbRequest` into the DBB's method, path and
  body, for the app's proxy to reuse. `readEnvelope` maps the DBB's
  `status` (`"0"`, `"1"`, `"-1"`; it answers HTTP 200 regardless, and
  `dbbStatusOf` reads it for the proxy, which passes the body on), one
  `map-*.ts` per endpoint maps its JSON, and `DbbObject` checks each
  field's type on the way.

## Tests

Every mapper's spec reads recorded, anonymised DBB responses: see
[`src/lib/dbb/fixtures/README.md`](src/lib/dbb/fixtures/README.md) for how
they are recorded and which case each one covers. Raw responses name real
children and never enter the repo (ADR 0019).

```sh
npx nx test feat-shared-basketball-data
npx nx run feat-shared-basketball-data:typecheck-specs
```
