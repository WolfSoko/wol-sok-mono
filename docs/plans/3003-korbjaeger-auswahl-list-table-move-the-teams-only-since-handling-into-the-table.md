# Plan #3003: Korbjäger Auswahl list table: move the Teams-only since handling into the table

Spec: [docs/specs/3003-korbjaeger-auswahl-list-table-move-the-teams-only-since-handling-into-the-table.md](../specs/3003-korbjaeger-auswahl-list-table-move-the-teams-only-since-handling-into-the-table.md)

Files are relative to `libs/features/korbjaeger-auswahl/src/lib/`. Each task ends with
`npx nx run-many -t test,typecheck-specs,lint -p feat-korbjaeger-auswahl korbjaeger` green and
`npx nx format:write`. Tasks 2 to 5 move types together (the lib does not compile in between),
so they are one `refactor(feat-korbjaeger-auswahl)` commit, written test first: the new specs of
each task go in before its code.

1. **Spec and plan.** This file and the spec. Commit:
   `docs(feat-korbjaeger-auswahl): spec and plan for the generic since handling (#3003)`.
2. **Optional `since`, no `orderedBySince`.** `selection-entries.ts` (`ReadEntry.since?`),
   `list-descriptor.ts` (drop `orderedBySince`, `added(value, since)` without `after`),
   `lists/club-colors.ts` (read without `since`), `lists/teams.ts`, `lists/children.ts`.
   Test: `selection-lists.spec.ts` gains "club colours read without since".
3. **Types from the table.** `selection-lists.ts`: drop `ListTypes`, infer `ListValue`,
   `ListField`, `ListDocumentField` from `typeof LIST_DESCRIPTORS`; `SinceByList` and
   `AuswahlInhalt.since`; `withEntryAt`, `sinceOf`, `withSince`. `auswahl-dokument.ts`: derived
   `AuswahlDokument` type. Test: `selection-lists.spec.ts` (`withEntryAt` for Kinder, `sinceOf`).
4. **Writer reports its since.** `auswahl-dokument.ts`: reader fills `since` per list and the
   highest from every read `since`; `auswahlFelder` returns `SelectionWrite`
   (`fields`, `since`, `lastSince`), looks up known `since` per list; drop
   `geschriebeneTeamsSeit`, `mitTeamsSeit`, `LISTS_BY_SINCE`. Callers: `lokale-auswahl.ts`,
   `geraet-uebernehmen.ts` take `.fields`. Test: `auswahl-dokument.spec.ts` (known Kind since,
   `lastSince`, `since` returned; existing Team cases rewritten on `since.teams`).
5. **Changes and Firestore.** `auswahl-aenderungen.ts`: `folgenAenderung`/`teamPlatz` through
   `withEntryAt`/`sinceOf`, comments; `firestore-auswahl.ts`: `lastSince` budget, pending changes
   through `withSince`. Tests: `auswahl-aenderungen.spec.ts`, `zusammenfuehren.spec.ts`,
   `firestore-auswahl.spec.ts` on `since`, then `npx nx run korbjaeger:test-emulator`.
6. **Docs and checks.** CLAUDE.md only where it names a removed identifier (none expected); grep of
   acceptance 1; `npx nx affected -t lint,lint-templates,test,typecheck-specs`.
