# Spec #2983: Korbjäger: finish the English-names migration and remove the transitional code

Issue: [#2983](https://github.com/WolfSoko/wol-sok-mono/issues/2983), follow-up
of [#2966](https://github.com/WolfSoko/wol-sok-mono/issues/2966)
([PR #2982](https://github.com/WolfSoko/wol-sok-mono/pull/2982), released
2026-11-09 19:48 UTC). Runs after the orphan cleanup of
[#2986](https://github.com/WolfSoko/wol-sok-mono/issues/2986)
([PR #2993](https://github.com/WolfSoko/wol-sok-mono/pull/2993)).

## Goal

No Korbjäger code, rule, index or text knows the German names of before
#2966 any more.

## Non-goals

- **No server-side move of `auswahl/{uid}`** (the issue's step 1). The
  owner's production run of `cleanup-orphans` on 2026-11-10 (about 08:00 UTC)
  listed 0 `auswahl` documents, and since #2982 the rules let clients only
  get and delete them, so none can appear: there is nothing to move
  (manager's decision on the spec, request 845).
- No move of device keys on devices not started since the release: the
  removal drops them (they hold only that device's choices, as the issue
  says).
- No change to what version 3 stores, to the rules of `selections/{uid}` or
  to `deletedAccounts`.
- The cleanup CLI (`src/cleanup/`) stays, with its orphan step, as #2986
  left it.

## Decisions

- **Removed** (the issue's list): `legacy-selection.ts`,
  `legacy-account-migration.ts`, `legacy-device-selection.ts` and their
  exports and specs; `LEGACY_DEVICE_KEYS`, `moveLegacyDeviceKeys` and their
  call in `main.ts`; the second key of the theme script in `index.html`; the
  `auswahl` match and the `geloeschteKonten` check in `firestore.rules`; the
  `geloeschteKonten` TTL in `firestore.indexes.json`; the legacy tombstone
  and the legacy delete in `kontoGeloescht`; the legacy delete in the
  account deletion of `FirebaseKontoDienst`;
  `LEGACY_DELETED_ACCOUNTS_COLLECTION`; the migration sentences of the
  privacy policy (sections 4 to 6); the emulator specs and spec cases of all
  of these; the docs (`CLAUDE.md`) that name them.
- **`LEGACY_CHOICES_COLLECTION` stays for the cleanup CLI only.** It keeps
  listing `auswahl/{uid}`, so a rerun shows the collection is still empty,
  and deletes an orphan's legacy document itself after `kontoGeloescht`,
  which from now on deletes `selections/{uid}` only.
- **The `geloeschteKonten` TTL leaves the index file, but stays live.** The
  deploy runs `firestore:indexes` without `--force`, so the Firebase CLI keeps
  a field override missing from the file instead of deleting it: the TTL
  stays for the legacy tombstones `kontoGeloescht` writes until this deploy,
  and they expire within a day plus TTL's day. Nothing reads them once the
  rules are deployed.
- **Merge after 2026-11-10 19:48 UTC**, one day after the release, so every
  legacy-only tombstone (written before #2982's deploy) has expired before
  the rules stop reading them. Before the merge request the owner reruns the
  dry run (`npx nx run korbjaeger-functions:cleanup-orphans --
  --project=korbjaeger`), which must still list 0 `auswahl` documents.

## Acceptance

1. No source, rule, index or spec of `korbjaeger`, `korbjaeger-functions`,
   `feat-korbjaeger-auswahl` or `feat-shared-korbjaeger-account` names
   `geloeschteKonten`, the device keys of before #2966 or the move of the
   names before #2966; `auswahl` as a collection remains only in the account
   lib's constant and the cleanup CLI.
2. `kontoGeloescht` writes the tombstone in `deletedAccounts` only and
   deletes `selections/{uid}` (emulator spec).
3. The rules refuse every client request on `auswahl/{uid}` and honour only
   `deletedAccounts` (emulator spec).
4. The cleanup CLI still lists and deletes an orphan's `auswahl/{uid}`
   (emulator spec).
5. The privacy policy no longer mentions the move of earlier versions' data
   (sections 4 to 6); its spec passes.
6. `test`, `test-emulator`, `typecheck-specs`, `lint`, `lint-templates` and
   `build` of the affected projects pass.
7. The owner's dry run before the merge lists 0 `auswahl` documents.
