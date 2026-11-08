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
with the engine, since the testing entry (below) holds only the fake DBB
and tools are no Nx project.

## What it holds

- **`BasketballData`**, the port the screens read: `ligaSuche`,
  `ligaSeite`, `ligaTeams`, `vereinsTeams`, `teamSpiele`, `tabelle`,
  `spiel`, `spielbericht`. All async, all in domain types, all rejecting
  with a `BasketballDataError` of kind `not-found`, `unavailable` or
  `unexpected-shape` only. Each takes an optional `{ signal }`
  (`ReadOptions`; `ReadSignal` is the part of an `AbortSignal` it uses,
  so the lib needs no DOM or Node types), which reaches the transport; a
  cancelled read rejects with the signal's reason.
- **The domain types** (`src/lib/domain/`). Ids are the DBB's stable ones:
  a Team is its `teamPermanentId`, a Kind its `person.id`; the
  season-specific `seasonTeamId` stays in the adapter. A Kader entry is a
  `BenannterSpieler` or an `AnonymerSpieler`, which has no person id and so
  cannot be marked. Each Kader of a Spielbericht says whether its
  Spielerwerte were recorded (`spielerwerteErfasst`); one whose numbers are
  all 0 has `false` and no Spielerwerte, never zeros. A player's field
  goals are `feldkoerbe(spielerwerte)` (twos and threes made).
  `spiel.ts` answers the questions a screen asks of a Spiel: the side a
  Team plays (`seiteVon`), its opponent (`gegnerVon`), the result
  (`ergebnisVon`) and whether it was cancelled or forfeited
  (`sonderfallVon`); a Spiel's `datum` is the German calendar day
  (`datumInDeutschland`). `partei.ts` tells a Team from a slot (`istTeam`,
  `parteiName`), for Spiele and Tabellen alike. `team-saison.ts` answers
  what a Team's page asks of its Saison: a Liga by id (`ligaVon`), the
  next Spiel to go to (`naechstesSpiel`: still to be played, so passing
  over cancelled, played and forfeited ones) and its Ligen
  with the current one first (`ligenAktuellZuerst`). `team-ueberblick.ts`
  answers what the overview asks: a Team's next Spiel, the Spiele
  before it that fall through (cancelled or forfeited) and its last
  result up to today (`teamUeberblick`), and the
  order of the overview's entries by next Spiel, those without one last
  (`nachNaechstemSpiel`).
- **`DbbBasketballData`** (`src/lib/dbb/`), the adapter over the DBB's
  undocumented JSON API (ADR 0018). It takes a `DbbTransport`, a function
  that answers one allowlisted `DbbRequest` with the DBB's JSON;
  `dbbHttpRequest` turns a `DbbRequest` into the DBB's method, path and
  body, for the app's proxy to reuse, and `dbbFetchInput` into `fetch`'s
  URL, method, headers and body (the proxy and the fixture tools call the
  DBB with it). What a transport throws, other than a
  `BasketballDataError`, becomes `unavailable`. `readEnvelope` maps the DBB's
  `status` (`"0"`, `"1"`, `"-1"`; it answers HTTP 200 regardless, and
  `dbbStatusOf` reads it for the proxy, which passes the body on;
  `dbbBoxscoreFinished` tells the proxy a Spielbericht whose result the
  Verband has confirmed, with both Kader listed, which the CDN may keep
  longer), one
  `map-*.ts` per endpoint maps its JSON, and `DbbObject` checks each
  field's type on the way.

## Testing entry

`@wolsok/feat-shared-basketball-data/testing` (`src/testing.ts`, for specs
and e2e only) holds `fakeDbbAnswer(method, path)`: how the DBB answers a
read, from the fixtures below (the recording of a recorded id, the DBB's
not-found envelope for any other id, `undefined` for a read it does not
know). The app's proxy specs and its e2e fake DBB server answer with it; a
read a later screen needs gets its row in `src/testing/fake-dbb.ts`. It
knows Team `313036`'s Spiele, the Tabellen of its two Ligen (`54862`, a
Vorrunde, and `54689`, a friendly Liga the DBB keeps none for) and its
Spiel `2861436` (match info and a Kader-only Spielbericht, its result not
confirmed yet), and the match info and boxscores of the adapter's Spiel
cases (`2911141` played with quarters and Spielerwerte, `2843811` a
confirmed Kader-only Spielbericht, `2843814` planned without Spielbericht,
`2930311` cancelled, `2930414` forfeited).

## Tests

Every mapper's spec reads recorded, anonymised DBB responses: see
[`src/lib/dbb/fixtures/README.md`](src/lib/dbb/fixtures/README.md) for how
they are recorded and which case each one covers. Raw responses name real
children and never enter the repo (ADR 0019).

```sh
npx nx test feat-shared-basketball-data
npx nx run feat-shared-basketball-data:typecheck-specs
```
