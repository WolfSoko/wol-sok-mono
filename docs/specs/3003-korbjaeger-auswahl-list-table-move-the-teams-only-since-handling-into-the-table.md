# Spec #3003: Korbjäger Auswahl list table: move the Teams-only since handling into the table

Issue: [#3003](https://github.com/WolfSoko/wol-sok-mono/issues/3003), found by `/simplify` on
[PR #3001](https://github.com/WolfSoko/wol-sok-mono/pull/3001) ([#2928](https://github.com/WolfSoko/wol-sok-mono/issues/2928)).
All files are in `libs/features/korbjaeger-auswahl/src/lib/` unless named otherwise.

## Goal

The list table (`LIST_DESCRIPTORS`) of #2928 still leaves four things per list or by hand:

1. A Team's place (its `since`) is carried by Teams-only code: `AuswahlInhalt.teamsSeit`,
   `geschriebeneTeamsSeit` and `mitTeamsSeit` in `auswahl-dokument.ts`, their use in
   `firestore-auswahl.ts`, and `TEAMS.added` reading `after.teamsSeit`.
2. `FirestoreAuswahl.letzterSeit` re-derives the since budget (`seit` plus the length of every
   list ordered by since) instead of being told the last `since` `auswahlFelder` gave out.
3. The stored field names are written three times: `ListTypes.document`, each descriptor's
   `field`, and the `AuswahlDokument` interface.
4. `ReadEntry` requires `since`, so the club colours are read with a made-up `since` of 0.

After this change each of these is handled once, for every list, through the table.

## Non-goals

- No change to persisted data: document shape, field names, version (3), storage key, the
  Firestore rules and their spec stay byte for byte.
- No new behaviour in the app: no undo for unmarking a Kind (the generic place only makes it
  possible later), no change to `Auswahl`'s port (`folgen(team, platz?)`,
  `entfolgen` resolving with `TeamPlatz`).
- No renaming of the existing German identifiers ([#2967](https://github.com/WolfSoko/wol-sok-mono/issues/2967),
  part B [#3010](https://github.com/WolfSoko/wol-sok-mono/issues/3010)). Every name this change
  introduces or rewrites is English (CLAUDE.md coding rule 10); untouched German names stay.

## Decisions

1. **A since map per list on `AuswahlInhalt`.** `teamsSeit?: ReadonlyMap<TeamId, number>` becomes
   `since?: SinceByList`, `{ readonly [L in AuswahlListe]?: ReadonlyMap<number, number> }`, the
   `since` of each entry by its id, where known. The reader fills it for every list whose entries
   carry one; `auswahlFelder` looks a new entry's `since` up there before it gives out the next
   one, so "joins at its old place" holds for every list ordered by since. The descriptor's
   `added` no longer takes the after-state (`after`), which also removes `list-descriptor.ts`'s
   type import of `AuswahlInhalt`.
   _Why:_ the place is a property of the list's order, not of Teams; one map per list keeps the
   type generic without per-list fields.
2. **Placing an entry at a known since is generic.** `folgenAenderung`'s insertion before the first
   later entry and `teamPlatz` become list-generic helpers in `selection-lists.ts`
   (`withEntryAt(list, selection, value, since?)`, `sinceOf(list, selection, id)`); the Team change
   functions call them for `teams`. `TeamPlatz` stays the port's type.
3. **`auswahlFelder` reports what it gave out.** It returns `SelectionWrite`:
   `{ fields: AuswahlFelder; since: SinceByList; lastSince: number }`: the fields to write, the
   `since` it wrote for each entry that joins (given out or known), and the last one it gave out
   (`firstSince - 1` where it gave out none). `FirestoreAuswahl` keeps `lastSince` as its budget
   and shows pending changes with `since` merged in (`withSince`, generic successor of
   `mitTeamsSeit`); `geschriebeneTeamsSeit` disappears, as nothing has to parse written fields
   again.
   _Why:_ the writer knows exactly what it gave out; re-deriving it over-reserves and has to know
   which lists are ordered by since.
4. **Field names come from the descriptors.** `ListTypes` goes: `ListValue<L>`, `ListField<L>` and
   `ListDocumentField<L>` are inferred from `typeof LIST_DESCRIPTORS` (each descriptor constant is
   typed with its own literal `field`). The `AuswahlDokument` interface is replaced by a type
   derived from the table (`version` plus each list's field as a map), so the doc comments that
   name it (account lib, app testing helpers) stay true.
5. **`since` is optional on `ReadEntry`.** A list ordered by its own `order` (club colours) reads
   its entries without one. `orderedBySince` goes from the descriptor: a list is ordered by since
   exactly when its entries carry one, and `order` already marks the one that is not;
   `LISTS_BY_SINCE` goes with its two users (decisions 3 and the highest since, which now takes
   every read entry's `since`).

## Acceptance

1. `grep -rn "teamsSeit\|geschriebeneTeamsSeit\|mitTeamsSeit\|letzterSeit\|LISTS_BY_SINCE\|orderedBySince\|ListTypes"`
   over `libs/features/korbjaeger-auswahl` and `apps/korbjaeger` finds nothing.
2. A Team unfollowed and followed again with its `TeamPlatz` returns to its old place, in both
   adapters (existing contract suite `auswahlVertrag`, `LokaleAuswahl` in Jest, `FirestoreAuswahl`
   in `korbjaeger:test-emulator`).
3. A new unit spec shows the generic place: a Kind given a known `since` in `AuswahlInhalt.since`
   is written with that `since` by `auswahlFelder`, and `withEntryAt` puts it before the first
   later Kind.
4. `auswahlFelder`'s `lastSince` is the last `since` it gave out (spec: two new entries from 100
   give 101; none gives 99) and `FirestoreAuswahl` gives two changes within one millisecond
   increasing `since` values (existing specs).
5. Club colours read without a `since` (spec on `CLUB_COLORS.read`).
6. Stored data unchanged: the existing document specs (`auswahl-dokument.spec.ts`,
   `selection-lists.spec.ts` round trips, `lokale-auswahl.spec.ts`), the rules' emulator spec and
   `firestore-collections.spec.ts` pass unchanged.
7. `test`, `typecheck-specs`, `lint`, `lint-templates` of `feat-korbjaeger-auswahl` and
   `korbjaeger`, and `korbjaeger:test-emulator`, green; CI green.

## Open questions

None. Overlap: [PR #3009](https://github.com/WolfSoko/wol-sok-mono/pull/3009) (#2983) removes the
legacy modules and touches only `src/index.ts` of this lib; whichever merges second rebases.
