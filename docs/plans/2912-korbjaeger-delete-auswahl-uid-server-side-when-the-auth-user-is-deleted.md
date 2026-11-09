# Plan #2912: delete auswahl/<uid> server-side when the Auth user is deleted

Spec: [docs/specs/2912-korbjaeger-delete-auswahl-uid-server-side-when-the-auth-user-is-deleted.md](../specs/2912-korbjaeger-delete-auswahl-uid-server-side-when-the-auth-user-is-deleted.md)

Each task is test first, then code; `nx format:write` and
`nx affected -t lint,lint-templates` before each commit.

1. **Rules: the tombstone** — `apps/korbjaeger/firestore.rules`
   (`istBesitzer` refuses while `geloeschteKonten/{uid}` exists; no client
   access to `geloeschteKonten`), cases in
   `apps/korbjaeger/src/firestore-rules.emulator.ts`, the TTL override in a
   new `apps/korbjaeger/firestore.indexes.json`.
   Commit `feat(korbjaeger): refuse a deleted account's writes by a tombstone`.
2. **Scaffold `korbjaeger-functions`** — `project.json` (`build`, `test`,
   `test-emulator`, `deploy`), `package.json`, tsconfigs, Jest configs,
   `emulator.json` (ports of its own), `src/config.ts` (`REGION`),
   `package-json.spec.ts`, `config.spec.ts` (region equals
   `REGIONEN.firestore.id`, read from the app's file).
   Commit `feat(korbjaeger-functions): add the app for Korbjäger's functions`.
3. **The handler** — `src/konto-geloescht.ts` (`kontoGeloescht(db, uid,
   now)`: tombstone, then delete) with `src/konto-geloescht.emulator.ts`:
   the state after a run, a rerun, a rerun after a failure between the
   steps, and the two-device test against the app's real rules
   (`@firebase/rules-unit-testing` for the devices, admin Firestore for the
   handler, one emulator project).
   Commit `feat(korbjaeger-functions): delete the Auswahl of a deleted account`.
4. **The trigger and the deploy** — `src/main.ts` (`v1.region(REGION)
   .runWith({ failurePolicy: true }).auth.user().onDelete`),
   `firebase.korbjaeger.json` (codebases `default` and `konto`, indexes),
   `korbjaeger:deploy` (`functions:default`, `firestore:rules,
   firestore:indexes`), `korbjaeger-functions:deploy`, specs in both apps'
   `firebase-deploy.spec.ts`, CI's emulator run picks the new target up.
   Commit `feat(korbjaeger-functions): deploy the deletion trigger`.
5. **Privacy policy and docs** — section 6 of
   `datenschutz.component.html` (and its spec), `CLAUDE.md`'s Korbjäger
   section.
   Commit `docs(korbjaeger): the server deletes the Auswahl with the account`.
