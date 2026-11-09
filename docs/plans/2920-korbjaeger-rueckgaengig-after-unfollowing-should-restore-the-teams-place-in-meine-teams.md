# Plan #2920: "Rückgängig" restores the Team's place in Meine Teams

Spec: [docs/specs/2920-…](../specs/2920-korbjaeger-rueckgaengig-after-unfollowing-should-restore-the-teams-place-in-meine-teams.md)

Each task is test first; before each commit `npx nx format:write`,
`npx nx affected -t lint,lint-templates,test`.

1. **Model: places in the document.** `auswahl-dokument.ts`: optional
   `teamsSeit` on `AuswahlInhalt`, filled by `auswahlDokumentLesen` (lists
   counted 1, 2, 3 …); `auswahlFelder` writes a new Team's `seit` from it.
   `auswahl.ts`: the `TeamPlatz` type. `auswahl-aenderungen.ts`:
   `folgenAenderung(team, platz?)` inserts by `seit`, `entfolgenAenderung`
   drops the entry, `teamPlatz(inhalt, team)`.
   Tests: `auswahl-dokument.spec.ts` (new), `auswahl-aenderungen.spec.ts`
   (new). Commit `feat(korbjaeger): keep each Team's seit in the Auswahl's content`.
2. **Port and adapters.** `Auswahl.entfolgen` resolves with `TeamPlatz |
   undefined`, `folgen(team, platz?)`; `LokaleAuswahl` and
   `FirestoreAuswahl` return the state a change applied to and show what
   they stored; `KontoSitzung` forwards; `fakeAuswahl` resolves `undefined`.
   Tests: `auswahlVertrag` (acceptance 1-5, 7, 8), `lokale-auswahl.spec.ts`
   (6), the Firestore emulator run of the contract. Commit
   `feat(korbjaeger): restore a Team at the place it was unfollowed from`.
3. **Undo in place.** `TeamFolgenComponent` passes the place to
   `NachEntfolgen.entfolgt`, whose "Rückgängig" follows with it. Tests:
   `nach-entfolgen.spec.ts`, `team-folgen.component.spec.ts`,
   `e2e/meine-teams.spec.ts` (two Teams). `CLAUDE.md`'s sentence on the undo.
   Commit `feat(korbjaeger): "Rückgängig" puts the Team back in its place`.
