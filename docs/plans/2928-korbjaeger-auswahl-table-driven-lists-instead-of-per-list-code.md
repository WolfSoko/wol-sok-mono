# Plan #2928: Korbjäger Auswahl: table-driven lists instead of per-list code

Spec: [docs/specs/2928-korbjaeger-auswahl-table-driven-lists-instead-of-per-list-code.md](../specs/2928-korbjaeger-auswahl-table-driven-lists-instead-of-per-list-code.md)

All files under `apps/korbjaeger/src/app/`. Each task ends with
`npx nx test korbjaeger` green, lint and format, and one commit.

1. **Spec and plan.** `docs/specs/2928-…`, `docs/plans/2928-…`. Commit:
   `docs(korbjaeger): spec and plan for table-driven Auswahl lists`.
2. **Descriptors and table, test first.** New `auswahl/auswahl-eintraege.ts`
   (shared helpers moved out of `auswahl-dokument.ts`),
   `auswahl/auswahl-liste.ts` (interface), `auswahl/listen/{teams,kinder,vereinsfarben}.ts`,
   `auswahl/auswahl-listen.ts` (type map, table, `AUSWAHL_GRENZEN`,
   `AUSWAHL_LISTEN`, `AuswahlInhalt`, `LEERE_AUSWAHL`, `jedeListe`). Test:
   `auswahl/auswahl-listen.spec.ts` (round trip per list, table equals
   `AUSWAHL_LISTEN`), red before the files exist. Commit:
   `refactor(korbjaeger): describe each Auswahl list once`.
3. **Document through the table.** `auswahl-dokument.ts`:
   `auswahlDokumentLesen`, `auswahlFelder`, `auswahlDokumentMit` loop over
   the table; per-list readers and mergers removed. Tests: the existing
   `lokale-auswahl.spec.ts`, `firestore-auswahl.spec.ts`,
   `zusammenfuehren.spec.ts` stay green. Commit:
   `refactor(korbjaeger): read and write the Auswahl document by its list table`.
4. **Changes, joining, takeover.** `auswahl-aenderungen.ts`
   (`abgebenAenderung`, list equalities), `zusammenfuehren.ts`,
   `geraet-uebernehmen.ts`, `firestore-auswahl.ts` (`firestoreFelder`,
   `letzterSeit`). Tests: existing unit specs, then
   `npx nx run korbjaeger:test-emulator`. Commit:
   `refactor(korbjaeger): join and take over Auswahl lists by the table`.
5. **Signals and the session.** `listenSignale` helper; `LokaleAuswahl`,
   `FirestoreAuswahl`, `konto-sitzung.ts` (`ohne`, `vereint`,
   `AktuelleAuswahl`). Tests: `konto-sitzung.spec.ts`,
   `einstellungen.component.spec.ts`, the adapters' specs. Commit:
   `refactor(korbjaeger): build Auswahl signals from the list table`.
6. **Docs.** CLAUDE.md's Korbjäger Auswahl paragraph names
   `AUSWAHL_LISTEN_ARTEN` as where a new list goes. Commit:
   `docs(korbjaeger): name the Auswahl list table in CLAUDE.md`.
7. **Checks before the PR**: `npx nx format:write`,
   `npx nx affected -t lint,lint-templates,test,typecheck`,
   `npx nx run korbjaeger:test-emulator`.
