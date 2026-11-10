# Plan #2928: Korbjäger Auswahl: table-driven lists instead of per-list code

Spec: [docs/specs/2928-korbjaeger-auswahl-table-driven-lists-instead-of-per-list-code.md](../specs/2928-korbjaeger-auswahl-table-driven-lists-instead-of-per-list-code.md)

Built after [#2917](https://github.com/WolfSoko/wol-sok-mono/issues/2917)
merged (manager's decision, 2026-11-09), on the lib
`libs/features/korbjaeger-auswahl/src/lib/` (files below are relative to
it, unless under `apps/`). Each task ends with
`npx nx run-many -t test,typecheck-specs -p feat-korbjaeger-auswahl korbjaeger`
green, lint and format. The tasks were committed as one refactor commit,
since each leaves the lib uncompilable without the next (the types move
together); the squash merge makes it one commit anyway.

1. **Spec and plan.** `docs/specs/2928-…`, `docs/plans/2928-…`. Commit:
   `docs(korbjaeger): spec and plan for table-driven Auswahl lists`.
2. **Descriptors and table.** New `auswahl-eintraege.ts`
   (shared helpers moved out of `auswahl-dokument.ts`),
   `auswahl-liste.ts` (interface), `listen/{teams,kinder,vereinsfarben}.ts`,
   `auswahl-listen.ts` (type map, table, `AUSWAHL_GRENZEN`,
   `AUSWAHL_LISTEN`, `AuswahlInhalt`, `LEERE_AUSWAHL`, `jedeListe`). Test:
   `auswahl-listen.spec.ts` (round trip per list, table equals
   `AUSWAHL_LISTEN`), checked by a hand mutation (a descriptor without
   `geaendert` turns it red).
3. **Document through the table.** `auswahl-dokument.ts`:
   `auswahlDokumentLesen`, `auswahlFelder`, `auswahlDokumentMit` loop over
   the table; per-list readers and mergers removed. Tests: the existing
   `lokale-auswahl.spec.ts`, `firestore-auswahl.spec.ts`,
   `zusammenfuehren.spec.ts` stay green.
4. **Changes, joining, takeover.** `auswahl-aenderungen.ts`
   (`abgebenAenderung`, list equalities), `zusammenfuehren.ts`,
   `geraet-uebernehmen.ts`, `firestore-auswahl.ts` (`firestoreFelder`,
   `letzterSeit`). Tests: existing unit specs, then
   `npx nx run korbjaeger:test-emulator`.
5. **Signals and the session.** `listenSignale` helper; `LokaleAuswahl`,
   `FirestoreAuswahl`, `konto-sitzung.ts` (`ohne`, `vereint`,
   `AktuelleAuswahl`). Tests: `konto-sitzung.spec.ts`,
   `einstellungen.component.spec.ts`, the adapters' specs.
6. **Docs.** CLAUDE.md's Korbjäger Auswahl paragraph names
   `AUSWAHL_LISTEN_ARTEN` as where a new list goes.
   Tasks 2 to 6 are one commit:
   `refactor(feat-korbjaeger-auswahl): describe each Auswahl list once, in a table`.
7. **Checks before the PR**: `npx nx format:write`,
   `npx nx affected -t lint,lint-templates,test,typecheck`,
   `npx nx run korbjaeger:test-emulator`.
