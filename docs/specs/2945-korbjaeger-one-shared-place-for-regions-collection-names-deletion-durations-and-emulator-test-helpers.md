# 2945 — Korbjäger: one shared place for regions, collection names, deletion durations and emulator test helpers

Issue: [#2945](https://github.com/WolfSoko/wol-sok-mono/issues/2945), found by `/simplify` on PR [#2943](https://github.com/WolfSoko/wol-sok-mono/pull/2943) ([#2912](https://github.com/WolfSoko/wol-sok-mono/issues/2912)).

## Goal

Every value the Korbjäger app and `korbjaeger-functions` both depend on lives once, in a lib both import, and the files that cannot import it (`firestore.rules`, `firestore.indexes.json`, the deploy command) are checked against it by a spec:

1. the Firestore region (`europe-west3`, Frankfurt am Main),
2. the collection names `auswahl` and `geloeschteKonten`,
3. the deletion durations the privacy policy's section 6 names (tombstone a day, retries up to 7 days, TTL up to a day after expiry),
4. the Firebase emulator test helpers that are copied between apps (`emulatorEnv`, the rules-test environment setup).

## Non-goals

- Renaming the persisted names (`auswahl`, `geloeschteKonten`, document fields): that is [#2966](https://github.com/WolfSoko/wol-sok-mono/issues/2966), with a migration. This change makes that rename a one-line edit of the constants.
- Renaming the existing German identifiers of the app or `feat-korbjaeger-auswahl` ([#2967](https://github.com/WolfSoko/wol-sok-mono/issues/2967)), beyond the names this change rewrites (below).
- Changing what the app stores, deletes or says: the privacy policy's wording stays the same in meaning; only its numbers come from constants.

## Decisions

1. **A new lib `feat-shared-korbjaeger-account`** (`libs/features/korbjaeger-account`, alias `@wolsok/feat-shared-korbjaeger-account`, tag `feat-shared`, Jest). Reason: the functions app is Node-only and may import no other app; `feat-korbjaeger-auswahl` imports the Firebase web SDK, which the functions bundle (`thirdParty: false`) must not pull in. A `feat-shared` lib with plain constants is what both apps (tag `app`) and `feat-korbjaeger-auswahl` (tag `feature`) may depend on. Proprietary like every Korbjäger folder: its own copy of the proprietary `LICENSE`, `"license": "UNLICENSED"` and a line in the root `LICENSE`.
2. **Its exports, English (CLAUDE.md rule 10; persisted values unchanged):**
   - `FIRESTORE_REGION = { id: 'europe-west3', place: 'Frankfurt am Main' }`
   - `CHOICES_COLLECTION = 'auswahl'`, `DELETED_ACCOUNTS_COLLECTION = 'geloeschteKonten'`
   - `TOMBSTONE_DAYS = 1` and `TOMBSTONE_DURATION_MS` derived from it
   - `DELETION_RETRY_DAYS = 7` (how long Cloud Functions retries a 1st-gen background function with `failurePolicy`: Google's limit, documented as such)
   - `TTL_DELETION_DAYS = 1` (how long after `expireAt` Firestore's TTL deletes a document at the latest: Google's figure, documented as such)
3. **The Nitro function's region stays in the app**, in a file without imports (`src/shared/function-region.ts`): `vite.config.ts` reads it, and a Vite config cannot resolve `@wolsok/*` aliases (checked: `loadConfigFromFile` fails with `UNRESOLVED_IMPORT`). The app's `REGIONEN` becomes `REGIONS = { function: FUNCTION_REGION, firestore: FIRESTORE_REGION }` with `id`/`place`: the rewritten name is English, and both regions share one shape.
4. **`korbjaeger-functions/src/config.ts`** takes `REGION` from `FIRESTORE_REGION.id` and drops its own collection and duration constants; `config.spec.ts`'s regex over the app's file goes, and so does `regionen.ts` in the `test` inputs. A spec checks that the `deploy` command's `--location` is `REGION` (today a third copy of the region).
5. **`feat-korbjaeger-auswahl`'s `AUSWAHL_SAMMLUNG`** is `CHOICES_COLLECTION` from the new lib (re-exported under the old name only if callers outside the lib need it; today none do).
6. **Files that cannot import** are checked by specs in the app: `firestore.rules` matches `/${CHOICES_COLLECTION}/{uid}` and reads `/${DELETED_ACCOUNTS_COLLECTION}/$(uid)`; `firebase-deploy.spec.ts`'s TTL check takes `DELETED_ACCOUNTS_COLLECTION`. Emulator specs (app and functions) use the constants instead of string literals.
7. **The privacy policy's section 6 renders the durations** from the constants through a small German formatter in `rechtliches/` (`1` → „einen Tag", `n` → „n Tage"), so it reads as today. Its spec asserts the rendered text against the constants.
8. **A new lib `shared-firebase-emulator`** (`libs/shared/firebase-emulator`, alias `@wolsok/shared-firebase-emulator`, tag `shared`, MIT, used by specs only) holds `emulatorEnv(name)` (a variable `firebase emulators:exec` sets, an error naming `test-emulator` when missing) and `rulesTestEnvironment(projectId, firestore, rules)` (`initializeTestEnvironment` with the Firestore emulator's host and port and the denials' logging silenced). Users: `bacteria-wars-functions` and `korbjaeger-functions` (`src/testing/emulator.ts`) and the app (`src/testing/firestore-emulator.ts`, whose `emulatorProjekt` becomes a call of it). `alsGeraet` stays in the app: only the app uses it. Consequence accepted: a change to this tiny lib marks both functions apps as affected.
9. **CLAUDE.md** names the new libs and the moved constants in the Korbjäger and Licence sections.

## Acceptance

- A1: `europe-west3` appears in Korbjäger's TypeScript only in the new lib (`git grep`), the functions' `config.spec.ts` regex is gone, and a spec ties the functions' deploy `--location` to `REGION`.
- A2: `'auswahl'` and `'geloeschteKonten'` as collection names appear only in the new lib among `.ts` files; a spec fails when `firestore.rules` or `firestore.indexes.json` names another collection.
- A3: section 6 of `/privacy` reads as before („bis zu 7 Tage", „einen Tag", „spätestens einen weiteren Tag später"), its numbers rendered from the lib's constants; the spec checks them through the constants.
- A4: `emulatorEnv` exists once (in `shared-firebase-emulator`); `bacteria-wars-functions`, `korbjaeger-functions` and `korbjaeger` emulator suites pass (`test-emulator`).
- A5: `test`, `lint`, `lint-templates`, `typecheck-specs` and the `korbjaeger` build pass for every affected project; `nx graph` shows no cycle.
- A6: the new Korbjäger lib carries the proprietary `LICENSE`, `"license": "UNLICENSED"` and its line in the root `LICENSE`.

## Open questions

- None blocking. If the manager prefers keeping the app's `REGIONEN`/`funktion`/`ort` names until #2967, decision 3 shrinks to moving only the Firestore region.
