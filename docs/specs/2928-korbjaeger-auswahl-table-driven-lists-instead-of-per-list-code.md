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

The places that loop over the table afterwards
(`apps/korbjaeger/src/app/auswahl/` and `konto/`):

- `auswahl-dokument.ts`: `auswahlDokumentLesen` (each map read, the highest
  `seit`), `auswahlFelder` (the diff), `auswahlDokumentMit` (merge into the
  stored map, a version-1 list turned into a map).
- `firestore-auswahl.ts`: `firestoreFelder`, the list signals, the gap of
  `seit` a write reserves (`letzterSeit`).
- `lokale-auswahl.ts`: the list signals, `neuGelesen`.
- `auswahl-aenderungen.ts`: `abgebenAenderung`, the list equalities
  (`gleicheKinder`, `gleicheVereinsfarben`).
- `zusammenfuehren.ts`: joining each list up to its cap.
- `geraet-uebernehmen.ts`: one transaction a list.
- `konto/konto-sitzung.ts`: `ohne`, `vereint`, the `AktuelleAuswahl` signals.

## Non-goals

- **No change in behaviour or stored shape.** `AuswahlDokument`, its version
  (2), the Firestore rules and every spec's expectations stay as they are.
  This is a refactor; the existing unit and emulator specs are its safety net.
- **No change to the port `Auswahl`** (its signals and methods per list stay:
  screens call `folgen`, `markieren`, `vereinsfarbenSetzen`, which say what
  they do). The change functions in `auswahl-aenderungen.ts` that only one
  list has (`folgenAenderung`, `spitznameAenderung`, …) stay per list.
- **No move into a lib here.** The manager decided (2026-11-09) that
  [#2917](https://github.com/WolfSoko/wol-sok-mono/issues/2917) goes first:
  this refactor is built only after #2917 is merged, on the lib's paths.
  The paths in this spec name today's files in `apps/korbjaeger/src/app/`;
  read them as their place in the new lib, and the new files go next to
  the moved ones there.
- No change to `nicht-uebernommen-text.ts` (it already loops over
  `AUSWAHL_LISTEN` and its wording per list is UI text).

## Decisions

- **A descriptor `AuswahlListenArt<Wert, Feld>` per list** (new
  `auswahl/auswahl-liste.ts` for the interface, one file per list under
  `auswahl/listen/`: `teams.ts`, `kinder.ts`, `vereinsfarben.ts`), with
  - `schluessel(wert)`: the id the map stores it under (Team id, person id,
    Verein id);
  - `gleich(a, b)`: whether two entries are the same (Kind with its
    Spitzname, Verein with its colours);
  - `lesen(roh)`: the entries of a stored map or version-1 list with their
    `seit`, in order; `undefined` only where the list makes the whole
    document unreadable (Teams that are not all ids), as today;
  - `felder(vorher, nachher, seit)`: the entries a change writes, with
    `seit` a counter shared across lists, so new Teams and Kinder still get
    one millisecond each in the same order as today;
  - `mit(gespeichert, felder)`: those entries merged into a stored map;
  - `alsKarte(werte)`: a version-1 list as a map, for the first change;
  - `zusammen(konto, geraet)`: joining the device's into the account's,
    each list with its own rule (Kinder fill a missing Spitzname, Vereine
    keep their order by id); the cap comes from `AUSWAHL_GRENZEN`.
    Why: these are exactly the operations the fifteen places spell out per
    list; everything else is the same loop.
- **The table `AUSWAHL_LISTEN_ARTEN`** (in a new `auswahl/auswahl-listen.ts`,
  beside `AUSWAHL_GRENZEN`, `AUSWAHL_LISTEN` and `AuswahlInhalt`) is typed
  as a mapped type over one type map (`ListenTypen`: per list its `wert`
  and `feld`), and `AuswahlInhalt` and `AuswahlFelder` are derived from the
  same map. Generic code takes `<L extends AuswahlListe>`, so TypeScript
  keeps list and descriptor correlated without casts at the call sites;
  where a loop has to rebuild a whole `AuswahlInhalt`, one helper
  (`jedeListe`) does it, so the cast lives in one place.
- **`auswahl-dokument.ts` keeps the document** (version, reading, writing)
  and loses the per-list readers and mergers to the descriptors; the
  low-level helpers they share (`istKarte`, `idAus`, `istZahl`, `geordnet`,
  `ENTFERNT`, `RohesDokument`) move to `auswahl/auswahl-eintraege.ts`.
  Existing exports stay importable from where they are today (types
  re-exported from `auswahl-dokument.ts`), so screens and specs need no
  import changes beyond the touched modules.
- **Signals per list come from one helper** (`listenSignale(inhalt, …)`),
  which builds a `computed` per list with that list's equality; the adapters
  and `AktuelleAuswahl` assign its result. The port keeps its named
  properties.

## Acceptance

1. `teams`, `kinder` and `vereinsfarben` are each described by one
   descriptor in `AUSWAHL_LISTEN_ARTEN`; none of the places named in "Goal"
   names a list by hand any more for what the descriptor covers.
2. Every existing spec of the app passes unchanged in its expectations:
   `nx test korbjaeger` and `nx run korbjaeger:test-emulator` (rules,
   `FirestoreAuswahl` contract, takeover); `typecheck` and lint green.
3. A spec on the table checks each descriptor's round trip
   (`felder` → `mit` → `lesen` gives back `nachher`) and that
   `AUSWAHL_LISTEN_ARTEN` holds exactly `AUSWAHL_LISTEN`.
4. CLAUDE.md's Korbjäger section names the table where it describes the
   Auswahl document, so the next list goes there.

## Open questions

None. Whether the per-list change functions should become generic too is left
out on purpose (non-goals): they carry each list's meaning.
