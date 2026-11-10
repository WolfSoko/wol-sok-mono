# Spec #2930: Korbjäger: move the offline answer cache (letzte-antworten) into a lib

Issue: [#2930](https://github.com/WolfSoko/wol-sok-mono/issues/2930), left out
of [#2917](https://github.com/WolfSoko/wol-sok-mono/issues/2917) as a non-goal,
tracked in [#2370](https://github.com/WolfSoko/wol-sok-mono/issues/2370), part
of [#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861).

## Goal

The device's cache of the last good DBB answers (`LokaleLetzteAntworten`:
one `localStorage` key per proxy path, an index, a 7-day age limit, caps of
60 answers and 1,000,000 characters, quota eviction) and its upkeep (clear
what is too old at the start, on returning to the page and hourly) sit in
`apps/korbjaeger/src/app/basketball-data/`. They move into a lib of their
own, behind the storage port they already have (`AntwortSpeicher`), so the
cache is tested, tagged and boundary-checked on its own. The app keeps the
transport and the wiring.

## Non-goals

- **No behaviour change.** Same keys (`korbjaeger-answer:…`,
  `korbjaeger-answers`, as #2982 renamed them), same stored format (versions 2 and 1), same caps,
  ages and upkeep times; the privacy policy's text stays as it is.
- **`proxy-transport.ts` stays in the app**, with `SPEICHERBARE_ARTEN`
  (which reads are kept is the transport's decision, tied to the proxy and
  ADR 0019) and `KEINE_ANTWORTEN`.
- **No shared `localStorage` JSON helper** ([#2899](https://github.com/WolfSoko/wol-sok-mono/issues/2899)):
  only `istSpeicherVoll` moves to a shared place here; the wrappers stay.
- **The Angular tokens stay in the app**: `LETZTE_ANTWORTEN` (it reads the
  app's `geraeteSpeicher()` and `SPEICHERBARE_ARTEN`) and
  `SPEICHER_FREIGEBEN`.

## Decisions

- **New lib `libs/features/korbjaeger-antworten`**, project
  `feat-korbjaeger-antworten`, import path `@wolsok/feat-korbjaeger-antworten`,
  tag `feature` (it uses only the type `DbbRequestKind` of
  `feat-shared-basketball-data` and the new utils lib; only apps use it).
  Set up as `feat-korbjaeger-auswahl` from #2917: Vitest (`@nx/vitest`,
  jsdom, since the specs use `DOMException` and `document`), a
  `typecheck-specs` target, no components, no selector prefix, no Angular.
- **What moves**, with its spec: `letzte-antworten.ts` whole (the port
  `LetzteAntworten`, `LetzteAntwort`, `AntwortSpeicher`, `AntwortGrenzen`,
  `LokaleLetzteAntworten`, `ANTWORT_GRENZEN`, `MAX_ALTER_TAGE`,
  `MAX_ALTER_MS`, `ANTWORT_PRAEFIX`, `ANTWORT_INDEX`).
- **The upkeep becomes a framework-free function in the lib**:
  `antwortenPflegen(antworten, { document, arten })`
  clears at once, on `visibilitychange` to visible and every
  `PFLEGE_TAKT_MS` (an hour), and returns a function that stops it. The
  app's `LETZTE_ANTWORTEN` factory only builds the store, calls it with
  `SPEICHERBARE_ARTEN` and hands the stop to `DestroyRef`. Its timing cases
  move into the lib's spec (fake timers, no TestBed); the app's
  `letzte-antworten-pflege.spec.ts` keeps what needs the injector (the token
  clears at start, `SPEICHER_FREIGEBEN` empties the store).
- **`istSpeicherVoll` moves to a new utils lib `libs/utils/browser-storage`**
  (`utils-browser-storage`, `@wolsok/utils-browser-storage`, tag `utils`),
  as `isStorageFull` (utils are English). Both the cache lib and the
  Auswahl (in the app on `main`, in `feat-korbjaeger-auswahl` once #2937
  lands) import it from there; no copy. It is where #2899's helper will
  live too. Jest, as the other `libs/utils` libs.
- **The device-key check covers the lib.** `ANTWORT_PRAEFIX` and
  `ANTWORT_INDEX` leave the app, so `appQuellen`
  (`src/testing/app-quellen.ts`) walks the lib's `src/` too; the new folder
  joins `EIGENE_LIB_ORDNER` (which #2937 introduces).
- **Sequencing: built after #2937 (PR #2937) is on `main`.** Both change
  `app-quellen.ts`, `geraete-speicher.ts` (`istSpeicherVoll`), the
  CLAUDE.md Korbjäger section and `tsconfig.base.json`; building on top of
  it avoids a second move of `istSpeicherVoll` and a conflict either way.
  Should #2937 stall, this goes first and #2937 rebases.
- **CLAUDE.md's Korbjäger section** names the lib for the cache.
- **Licence**: the lib is Korbjäger's, so it carries the same proprietary
  `LICENSE` (copied from `feat-korbjaeger-auswahl`), `"license": "UNLICENSED"`
  and its line in the root `LICENSE` (#2956); `utils-browser-storage` is a
  shared lib and stays MIT.

## Acceptance

1. `LokaleLetzteAntworten`, the port and its constants live in
   `libs/features/korbjaeger-antworten`; the app imports them only through
   `@wolsok/feat-korbjaeger-antworten`. `letzte-antworten.ts` is gone from
   the app.
2. The lib imports nothing from `apps/` and nothing of Angular; lint shows
   no boundary violation, the graph no cycle.
3. `isStorageFull` lives in `libs/utils/browser-storage` with a spec
   (Chrome's and Firefox's quota names, other errors); the app and the
   cache lib use it, no `istSpeicherVoll` is left.
4. The lib's specs (moved `letzte-antworten.spec.ts`, new
   `antworten-pflege.spec.ts`) pass under `nx test feat-korbjaeger-antworten`;
   `typecheck-specs` passes.
5. The app's specs (`proxy-transport`, `basketball-data-resource`,
   `letzte-antworten-pflege`, `datenschutz`, `geraete-schluessel`) pass; the
   device-key spec fails on an unlisted `korbjaeger-…` literal put into the
   lib (checked once by hand).
6. `nx affected -t lint,lint-templates,test,typecheck-specs` is green and
   `nx build korbjaeger` builds.

## Open questions

- None blocking. Whether to wait for #2937 is asked with this draft.
