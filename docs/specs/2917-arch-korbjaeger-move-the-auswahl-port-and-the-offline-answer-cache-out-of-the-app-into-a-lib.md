# Spec #2917: Korbjäger: move the Auswahl port and the offline answer cache out of the app into a lib

Issue: [#2917](https://github.com/WolfSoko/wol-sok-mono/issues/2917), tracked
in [#2370](https://github.com/WolfSoko/wol-sok-mono/issues/2370).

## Goal

The `Auswahl` (Meine Teams, marked Kinder, Vereinsfarben) is a port with two
adapters (`LokaleAuswahl`, `FirestoreAuswahl`, the latter from
[#2911](https://github.com/WolfSoko/wol-sok-mono/pull/2911), merged), a stored
document format, the change functions both adapters apply, the sign-in
takeover and a shared contract suite. All of it sits in
`apps/korbjaeger/src/app/auswahl/`, so nothing keeps the app's screens from
reaching into an adapter, and the port cannot be tested, tagged or
boundary-checked on its own. It moves into a lib with a narrow public entry,
and the app keeps only the wiring.

## Non-goals

- **The offline answer cache (`letzte-antworten.ts`) stays in the app for
  now.** The issue marks it optional. It is tied to the app's proxy
  transport (`SPEICHERBARE_ARTEN`, the read's `Lesung`) and the device's
  storage maintenance; moving it is a lib of its own with its own storage
  port and gets a follow-up ticket, so this PR stays one reviewable move.
- **`ueberblick/` stays as it is.** Splitting its pure view models off is
  the issue's step 3; it needs its own design and goes to a follow-up.
- No behaviour change: no new field, no new rule, no version bump of the
  stored document, no change to the Firestore rules or the privacy policy's
  text.

## Decisions

- **New lib `libs/features/korbjaeger-auswahl`**, project
  `feat-korbjaeger-auswahl`, import path `@wolsok/feat-korbjaeger-auswahl`,
  tag `feature` (it may use `feat-shared-basketball-data`; only apps may use
  it). Specs run on Vitest like the app's (`@nx/vitest`, jsdom), with a
  `typecheck-specs` target. No components, so no selector prefix.
- **Secondary entry `/testing`** (`src/testing.ts`) holds `auswahlVertrag`
  and `fakeAuswahl`, as the bacteria and basketball libs do; excluded from
  `tsconfig.lib.json`.
- **What moves** (with its specs): `Auswahl` (the interface), the errors
  (`auswahl-fehler.ts`), `kind.ts`, `vereinsfarben-wahl.ts`,
  `auswahl-dokument.ts`, `auswahl-aenderungen.ts`, `zusammenfuehren.ts`,
  `geraet-uebernehmen.ts`, `lokale-auswahl.ts`, `firestore-auswahl.ts`,
  `testing/`. Their app-level helpers come along since the port's types
  need them: `vereinsfarben.ts` (the colour value, `KeineFarbeError`,
  `istFarbe`, `vereinsfarbenAus`, `gleicheFarben`; `farbschema.ts`, which
  derives Material colours, stays in the app), `gleicheFolge` and
  `istSpeicherVoll` (the app's other users import them from the lib, no
  copy).
- **What stays in the app**: the `AUSWAHL` token (its factory reads
  `KONTO_SITZUNG`, which is the app's wiring) and its spec; the emulator
  specs `firestore-auswahl.emulator.ts` and `geraet-uebernehmen.emulator.ts`,
  since they test the adapter against the app's own `firestore.rules`
  through the app's `test-emulator` target; they import the adapter and
  `auswahlVertrag` from the lib's entries.
- **The public entry exports only what the app uses** (types, adapters,
  takeover, errors, caps, the colour helpers); internals such as the change
  functions stay unexported where the app has no use for them.
- **The privacy policy's device-key check still covers the lib.**
  `geraete-schluessel.spec.ts` scans the app's sources for `korbjaeger-…`
  keys; `AUSWAHL_SCHLUESSEL` moves into the lib, so `appQuellen` also walks
  the lib's `src/` (its non-spec sources), else a new key there would escape
  the check.
- **CLAUDE.md's Korbjäger section** names the new paths.

## Acceptance

1. `auswahlVertrag`, `fakeAuswahl`, `LokaleAuswahl` and `FirestoreAuswahl`
   live in `libs/features/korbjaeger-auswahl`; the app imports them only
   through `@wolsok/feat-korbjaeger-auswahl` and `/testing`.
2. `apps/korbjaeger/src/app/auswahl/` holds only the `AUSWAHL` token, its
   spec and the two emulator specs.
3. The lib's specs (moved with the code) pass under
   `nx test feat-korbjaeger-auswahl`, and `typecheck-specs` passes.
4. `nx affected -t lint,lint-templates,test,typecheck-specs` is green; no new
   boundary violation; the graph shows no cycle.
5. `nx build korbjaeger` still builds.
6. The device-key spec scans the lib's sources too (a `korbjaeger-…` literal
   in the lib not listed in `GERAETE_SCHLUESSEL` fails it).

## Open questions

- None blocking. The answer cache and `ueberblick/` go to follow-up tickets
  through the manager.
