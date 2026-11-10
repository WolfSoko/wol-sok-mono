# Spec #2928: Korbjäger Auswahl: table-driven lists instead of per-list code

Found by `/simplify` on PR [#2927](https://github.com/WolfSoko/wol-sok-mono/pull/2927)
(Vereinsfarben in the Auswahl). Related:
[#2917](https://github.com/WolfSoko/wol-sok-mono/issues/2917) (moves the Auswahl into a lib),
[#2920](https://github.com/WolfSoko/wol-sok-mono/issues/2920) (undo keeps the Team's place).

## Goal

Each list of an `Auswahl` (`teams`, `kinder`, `vereinsfarben`) is described
once, by a descriptor in one table, and the code that today handles each list
by hand loops over that table instead. A fourth list then needs its
descriptor, its cap, its rules and its port methods, not edits in about
fifteen places.

The places that loop over the table afterwards (the lib
`libs/features/korbjaeger-auswahl/src/lib/`, and the app's
`apps/korbjaeger/src/app/konto/`):

- `auswahl-dokument.ts`: `auswahlDokumentLesen` (each map read, the highest
  `seit`), `auswahlFelder` (the diff), `auswahlDokumentMit` (merge into the
  stored map); `DOCUMENT_FIELD` (the stored field per list) becomes the
  descriptor's `feld`.
- `firestore-auswahl.ts`: `firestoreFelder`, the list signals, the gap of
  `seit` a write reserves (`letzterSeit`).
- `lokale-auswahl.ts`: the list signals, `neuGelesen`.
- `auswahl-aenderungen.ts`: `abgebenAenderung`, the list equalities
  (`gleicheKinder`, `gleicheVereinsfarben`).
- `zusammenfuehren.ts`: joining each list up to its cap.
- `geraet-uebernehmen.ts`: one transaction a list.
- `konto/konto-sitzung.ts` (app): `ohne`, `vereint`, `istLeer`, the
  `AktuelleAuswahl` signals.

## Non-goals

- **No change in behaviour or stored shape.** `AuswahlDokument`, its version
  (3), the Firestore rules and every spec's expectations stay as they are.
  This is a refactor; the existing unit and emulator specs are its safety net.
- **No change to the port `Auswahl`** (its signals and methods per list stay:
  screens call `folgen`, `markieren`, `vereinsfarbenSetzen`, which say what
  they do). The change functions in `auswahl-aenderungen.ts` that only one
  list has (`folgenAenderung`, `spitznameAenderung`, …) stay per list.
- **No move into a lib here.** The manager decided (2026-11-09) that
  [#2917](https://github.com/WolfSoko/wol-sok-mono/issues/2917) goes first;
  it was merged (PR [#2937](https://github.com/WolfSoko/wol-sok-mono/pull/2937)),
  so this refactor works on the lib `feat-korbjaeger-auswahl`.
- No change to the migration of versions 1 and 2 (`legacy-*.ts`), which
  reads the German fields and goes with #2966's follow-up.
- No change to `nicht-uebernommen-text.ts` (it already loops over
  `AUSWAHL_LISTEN` and its wording per list is UI text).

## Decisions

Built after #2917 and #2966 (version 3, English fields, no version-1 lists
left in the reader) and #2920 (`teamsSeit`, a Team's old place), so the
descriptor carries the stored field and the known place, and needs no
conversion of version-1 lists.

- **A descriptor `AuswahlListenArt<Wert, Feld, Dokument>` per list**
  (`auswahl-liste.ts` for the interface, one file per list under `listen/`:
  `teams.ts`, `kinder.ts`, `vereinsfarben.ts`, each with its stored types:
  `TeamFeld`, `KindEintrag`/`KindFeld`, `VereinsfarbenFeld`), with
  - `feld`: the document's field (`teams`, `children`, `clubColors`);
  - `id(wert)`: the DBB id the map stores it under;
  - `gleich(a, b)`: whether two entries are the same (Kind with its
    Spitzname, Verein with its colours);
  - `lesen(roh)`: the readable entries of the stored map with their `seit`,
    in order; `undefined` only where the list makes the whole document
    unreadable (Teams that are not all ids), as before;
  - `neu(wert, seit)` and `geaendert?(alt, neu)`: what a change writes of an
    entry that joins or changes; the diff itself (gone, new, changed) is one
    generic loop, with `seit` a counter shared across lists in
    `AUSWAHL_LISTEN`'s order, so new Teams and Kinder still get one
    millisecond each in the same order;
  - `bekannterSeit?(inhalt, wert)`: a place `nachher` already knows (a Team
    followed at its old place, `teamsSeit`);
  - `mit(gespeichert, felder)`: those entries merged into a stored map;
  - `ergaenzen?(konto, geraet)` and `ordnen?(liste)`: the list's own rule
    when the device's choices join the account's (Kinder fill a missing
    Spitzname, Vereinsfarben keep the order by Verein); joining up to the
    cap (`AUSWAHL_GRENZEN`) is one generic loop.
    Why: these are exactly what the places spelled out per list; the rest
    is the same loop.
- **The table `AUSWAHL_LISTEN_ARTEN`** (`auswahl-listen.ts`, beside
  `AUSWAHL_GRENZEN`, `AUSWAHL_LISTEN`, `AuswahlInhalt`, `LEERE_AUSWAHL`) is
  typed as a mapped type over one type map (`ListenTypen`: per list its
  `wert`, `feld` and `dokument`); `AuswahlInhalt` and `AuswahlFelder` (keyed
  by the stored field, as before) are derived from it. Generic helpers take
  `<L extends AuswahlListe>` and get their descriptor from `listenArt(liste)`.
  One helper, `jedeListe`, puts a value for each list together; TypeScript
  cannot check per list that its callback gives each list its own type (a
  concrete mapped type indexed by a generic key reads as all lists at once),
  so its callback is untyped and the one cast lives there; the callbacks
  are the typed generic helpers.
- **`auswahl-dokument.ts` keeps the document** (version, `AuswahlDokument`,
  reading, `auswahlFelder`, `auswahlDokumentMit`, `teamsSeit` helpers); the
  low-level helpers shared with the descriptors and the migration
  (`istKarte`, `idAus`, `istId`, `istZahl`, `vorSeit`, `eintraegeMit`,
  `ENTFERNT`, `RohesDokument`) move to `auswahl-eintraege.ts`. The lib's
  public entry keeps every export it had.
- **Signals per list come from one helper**, `listenSignale(lesen)` (its
  own file, the only part that needs Angular), which builds a `computed`
  per list with that list's equality from a reader of the list; both
  adapters and the app's `AktuelleAuswahl` use it. The port keeps its named
  properties.
- **The app's `ohne`, `vereint` and `istLeer`** become the lib's
  `auswahlOhne`, `auswahlVereint`, `auswahlLeer` (by each list's ids),
  exported from its entry.

## Acceptance

1. `teams`, `kinder` and `vereinsfarben` are each described by one
   descriptor in `AUSWAHL_LISTEN_ARTEN`; none of the places named in "Goal"
   names a list by hand any more for what the descriptor covers.
2. Every existing spec of the app passes unchanged in its expectations:
   `nx test korbjaeger` and `nx run korbjaeger:test-emulator` (rules,
   `FirestoreAuswahl` contract, takeover); `typecheck` and lint green.
3. A spec on the table (`auswahl-listen.spec.ts`) checks each list's round
   trip (`auswahlFelder` → `auswahlDokumentMit` → `auswahlDokumentLesen`
   gives back `nachher`), that `AUSWAHL_LISTEN_ARTEN` and `AUSWAHL_GRENZEN`
   hold exactly `AUSWAHL_LISTEN`, each list in a field of its own, and
   `auswahlOhne`/`auswahlVereint`/`auswahlLeer`.
4. CLAUDE.md's Korbjäger section names the table where it describes the
   Auswahl document, so the next list goes there.

## Open questions

None. Whether the per-list change functions should become generic too is left
out on purpose (non-goals): they carry each list's meaning.
