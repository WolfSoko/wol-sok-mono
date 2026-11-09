# Spec #2966: Korbjäger: rename the German Firestore fields and storage keys to English, with a migration

Issue: [#2966](https://github.com/WolfSoko/wol-sok-mono/issues/2966), part 2
of [#2961](https://github.com/WolfSoko/wol-sok-mono/issues/2961) (Coding
Rule 10). Blocks [#2967](https://github.com/WolfSoko/wol-sok-mono/issues/2967)
(identifiers).

## Goal

Every name Korbjäger persists is English: the Firestore collections and
fields, the `localStorage` keys and the fields of the device's selection.
Sign-in and sync are live in production, so every existing account document,
tombstone and device keeps its data: the new app reads the old names once,
writes them under the new ones and removes the old.

## Non-goals

- No rename of TypeScript identifiers (`AuswahlInhalt`, `LokaleAuswahl`,
  `kinder` in memory, …): that is #2967. Only types that describe the stored
  shape (`AuswahlDokument`, `KindEintrag`, `AuswahlFelder`) take the new field
  names, since they are the persisted names. New code is English.
- No server-side batch migration of dormant account documents: an account
  migrates when it is next opened (below). Their removal, and dropping the
  transitional code, is a follow-up (raised to the manager).
- DBB JSON fields stay as the DBB spells them.
- No change to what is stored, only to its names; the caps stay.

## Names

| Old                                        | New                            |
| ------------------------------------------ | ------------------------------ |
| collection `auswahl/{uid}`                 | `selections/{uid}`             |
| field `kinder`                             | `children`                     |
| field `vereinsfarben`                      | `clubColors`                   |
| entry field `seit` (Teams' values, Kinder) | `since`                        |
| entry field `spitzname`                    | `nickname`                     |
| `version: 2`                               | `version: 3`                   |
| collection `geloeschteKonten/{uid}`        | `deletedAccounts/{uid}`        |
| key `korbjaeger-auswahl`                   | `korbjaeger-selection`         |
| key `korbjaeger-angemeldet`                | `korbjaeger-signed-in`         |
| key `korbjaeger-zwischenspeicher-leeren`   | `korbjaeger-clear-cache`       |
| key `korbjaeger-installation-abgelehnt`    | `korbjaeger-install-dismissed` |
| key `korbjaeger-darstellung`               | `korbjaeger-theme`             |
| key prefix `korbjaeger-antwort:`           | `korbjaeger-answer:`           |
| key `korbjaeger-antworten`                 | `korbjaeger-answers`           |

`teams` and `version` stay. The rules' functions get English names too
(`isOwner`, `isVersion3`, `areTeams`, …): the file is rewritten anyway.

## Decisions

- **Version 3, one reader.** The new document is version 3 with the English
  fields, in Firestore and on the device. The reader of the current version
  reads only maps (version 1's lists are legacy only). A separate pure
  `legacySelection(raw)` reads a version 1 or 2 document with the German
  fields (lists included, as today's reader does) into an `AuswahlInhalt`;
  the migrations use it and nothing else does. Reason: the current reader
  stays simple, and the legacy code can go as one file once #2966's
  follow-up removes it.
- **Account migration on opening, through the takeover.** Before an
  account's selection is opened or the device's choices are taken in
  (`FirebaseKontoDienst.auswahl`, `.geraetUebernehmen`), the service runs
  `legacyAccountMigration(firestore, uid)` once per uid and visit: it reads
  `auswahl/{uid}` from the server; where it exists, it joins its content into
  `selections/{uid}` with the existing `geraetUebernehmen` (one transaction a
  map, as the rules' expression limit requires; account first, idempotent),
  then deletes `auswahl/{uid}`. The legacy document is deleted last, so an
  interrupted run repeats on the next opening and joins the same entries
  again without change. Where it fails (offline, refused), the account opens
  anyway and the next opening retries. Running it before the device's
  takeover keeps the account's older choices first. What would not fit under
  the caps is dropped with the legacy document (only possible where the new
  document filled since the release).
  Reason: reuses the tested, rules-aware merge instead of a second writer;
  no admin script against production.
- **Legacy collection read-and-delete only.** The rules allow the owner
  `get` and `delete` on `auswahl/{uid}`, nothing else. A tab of the old app
  still open at the release gets its writes refused (Firestore takes them
  back); the service worker reloads the app on a new version
  (`app-service-worker.ts`), so that window is short. Reason: accepting old
  writes would keep the German validation in the rules and could recreate a
  migrated document.
- **Tombstones in both collections for the transition.** The function
  writes `deletedAccounts/{uid}`; the rules refuse the owner while either
  `deletedAccounts/{uid}` or `geloeschteKonten/{uid}` exists, and both
  collection groups keep their TTL on `expireAt`. Reason: the functions and
  the rules deploy minutes apart, and a tombstone the old function wrote
  lives a day. Deleting the account deletes both selection documents, in the
  app (`auswahlLoeschen`) and in the function (`kontoGeloescht`).
- **Device keys move once at start.** `moveLegacyDeviceKeys(storage)` runs in
  `main.ts` before the app boots (before anything reads a key): it removes
  the old answer cache (prefix and index: a cache, rebuilt on the next read,
  and it frees space first), moves each flag and the theme to its new key
  where the new one is not set, and converts the device's selection
  (`legacySelection`, written as a version 3 document) to its new key. The
  old key goes only once the new one is written; a write that fails (storage
  full or blocked) leaves the old key for the next start. The pre-paint
  script in `index.html` reads `korbjaeger-theme`, else the old key, so the
  first start after the release does not flash the other look.
- **Collection names in one place** (approval condition, as
  [#2945](https://github.com/WolfSoko/wol-sok-mono/issues/2945) proposes):
  the new lib `feat-korbjaeger-collections` (`libs/features/korbjaeger-collections`,
  tag `feat-shared` (constants only, as a `feature` lib may not import
  another), proprietary like the app) holds `SELECTIONS_COLLECTION`,
  `DELETED_ACCOUNTS_COLLECTION` and both legacy names; it imports nothing,
  so `korbjaeger-functions` bundles it without Angular or the web SDK, and a
  change to the Auswahl lib does not redeploy the functions. The app, the
  Auswahl lib, the functions and the emulator specs import it; the rules and
  indexes, which cannot, are checked by the emulator specs and
  `firebase-deploy.spec.ts`. The rest of #2945 (regions, durations, emulator
  helpers) stays with #2945.
- **Legacy keys in one place.** The old device keys live in
  `LEGACY_DEVICE_KEYS` (`src/app/legacy-device-keys.ts`), the old selection
  key beside the new one in the Auswahl lib. `geraete-schluessel.spec.ts`
  accepts a `korbjaeger-…` key in the code that is either listed in
  `GERAETE_SCHLUESSEL` or in `LEGACY_DEVICE_KEYS`.
- **Privacy policy.** It renders the new keys from the constants as today;
  section 4 says that keys of an earlier version are renamed at the first
  start and removed, section 5 that a document of an earlier version is
  moved into the new one when the account is opened next and then deleted.
  Section 6 is unchanged in substance (both documents are deleted).
- **CLAUDE.md** names the new collections, fields and keys in its Korbjäger
  section.

## Acceptance

1. A fresh account writes `selections/{uid}` as version 3 with `teams`,
   `children` (`since`, `nickname`) and `clubColors`; the rules take only
   those keys and refuse version 2 and the German fields (emulator spec).
2. An account with a version 2 `auswahl/{uid}` (German fields) opened in the
   new app shows the same Teams in the same order, the same Kinder with
   their Spitznamen and the same Vereinsfarben; afterwards `selections/{uid}`
   holds them and `auswahl/{uid}` is gone (emulator spec). An interrupted
   migration repeats without duplicating or reordering (spec).
3. The rules allow the owner only `get` and `delete` on `auswahl/{uid}`;
   create and update are refused (emulator spec).
4. Deleting an account removes `selections/{uid}` and `auswahl/{uid}`, in the
   app and in `kontoGeloescht`, which writes `deletedAccounts/{uid}`; the
   rules refuse the owner while a tombstone exists in either collection
   (emulator specs); `firestore.indexes.json` has the TTL on both.
5. A device holding the old keys (selection of version 1 or 2, signed-in
   flag, clear-cache flag, install dismissal, theme, cached answers) starts
   with the same choices, still signed in, the same look and the same flags
   under the new keys; the old keys are gone, the old cached answers
   dropped. A full storage keeps the old selection key (spec).
6. `index.html` applies the theme from the new key, else the old one
   (`darstellung.spec.ts`).
7. The privacy policy lists the new keys and the migration sentences;
   `geraete-schluessel.spec.ts` and `datenschutz.component.spec.ts` pass.
8. `nx affected -t lint,lint-templates,test,typecheck-specs` and
   `korbjaeger:test-emulator`, `korbjaeger-functions:test-emulator` pass;
   the e2e passes (`korbjaeger:e2e`).

## Open questions

None. Settled at approval: the names as listed; the collection names in a
shared lib as #2945 proposes; a follow-up issue removes the legacy tombstone
check and its TTL right after one day, and the rest of the transitional code
and the dormant `auswahl/{uid}` documents (moved server-side first) after 90
days.
