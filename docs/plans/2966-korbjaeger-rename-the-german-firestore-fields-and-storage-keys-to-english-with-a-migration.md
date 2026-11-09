# Plan #2966: Korbjäger: rename the German Firestore fields and storage keys to English, with a migration

Spec: [docs/specs/2966-…](../specs/2966-korbjaeger-rename-the-german-firestore-fields-and-storage-keys-to-english-with-a-migration.md).
Test first in each task; `npx nx format:write` and
`npx nx affected -t lint,lint-templates` before each commit.

1. **Lib: version 3 document with English fields.**
   `libs/features/korbjaeger-auswahl/src/lib/auswahl-dokument.ts` (+ spec):
   `AUSWAHL_VERSION = 3`, `AuswahlDokument`/`KindEintrag`/`AuswahlFelder`
   with `children`, `clubColors`, `since`, `nickname`; the reader reads maps
   only; `auswahlDokumentMit`, `firestoreFelder` (`firestore-auswahl.ts`),
   `geraet-uebernehmen.ts` map list → field. Specs of `auswahl-aenderungen`,
   `lokale-auswahl`, `firestore-auswahl`, `zusammenfuehren` follow.
   Commit `feat(feat-korbjaeger-auswahl): store the selection as version 3 with English fields`.
2. **Lib: legacy reader.** New `legacy-selection.ts` (+ spec, moved cases of
   today's reader: version 1 lists, version 2 maps, malformed, newer):
   `legacySelection(raw): AuswahlInhalt | undefined`, exported for the app.
   Commit `feat(feat-korbjaeger-auswahl): read version 1 and 2 selections`.
3. **Lib: names and account migration.** `AUSWAHL_SAMMLUNG = 'selections'`,
   `LEGACY_SELECTION_COLLECTION = 'auswahl'`, `AUSWAHL_SCHLUESSEL =
   'korbjaeger-selection'`, `LEGACY_SELECTION_KEY`; new
   `legacy-account-migration.ts` (`legacyAccountMigration(firestore, uid)`:
   get legacy, `geraetUebernehmen`, delete legacy); new
   `legacy-device-selection.ts` (`moveLegacyDeviceSelection(storage)`).
   Emulator spec `apps/korbjaeger/src/app/auswahl/legacy-account-migration.emulator.ts`.
   Commit `feat(feat-korbjaeger-auswahl): migrate the legacy selection of an account and a device`.
4. **Rules and indexes.** `apps/korbjaeger/firestore.rules` in English,
   version 3, legacy collection get/delete, both tombstones;
   `firestore.indexes.json` TTL on `deletedAccounts` and `geloeschteKonten`;
   `src/firestore-rules.emulator.ts`, `src/firebase-deploy.spec.ts`,
   `src/testing/firestore-emulator.ts`, the auswahl emulator specs.
   Commit `feat(korbjaeger): rules for the English selection document`.
5. **App service.** `firebase-konto-dienst.ts`: memoized
   `legacyAccountMigration` before `auswahl()` and `geraetUebernehmen()`,
   `auswahlLoeschen` deletes both documents (+ spec).
   Commit `feat(korbjaeger): migrate an account's legacy selection on opening`.
6. **Device keys.** `geraete-speicher.ts`, `letzte-antworten.ts` new values;
   new `src/app/legacy-device-keys.ts` (`LEGACY_DEVICE_KEYS`,
   `moveLegacyDeviceKeys`, + spec) called in `src/main.ts`; `index.html`
   fallback and `darstellung.spec.ts`; `geraete-schluessel.spec.ts` accepts
   legacy keys; `e2e/pos/start.page.ts`.
   Commit `feat(korbjaeger): English device storage keys, moved at start`.
7. **Functions.** `apps/korbjaeger-functions/src/config.ts`
   (`SELECTIONS`, `DELETED_ACCOUNTS`, `LEGACY_SELECTIONS`),
   `konto-geloescht.ts` deletes both, writes the new tombstone;
   `konto-geloescht.emulator.ts`.
   Commit `feat(korbjaeger-functions): English collections for the deletion`.
8. **Privacy policy and docs.** `datenschutz.component.html` (+ spec)
   migration sentences; `CLAUDE.md` Korbjäger section; ADR 0019 where it
   names the fields.
   Commit `docs(korbjaeger): English persisted names in the policy and CLAUDE.md`.
9. **Verify.** `nx affected -t lint,lint-templates,test,typecheck-specs`,
   `korbjaeger:test-emulator`, `korbjaeger-functions:test-emulator`,
   `korbjaeger:e2e`.
