# Spec #2983: Korbjäger: finish the English-names migration and remove the transitional code

Issue: [#2983](https://github.com/WolfSoko/wol-sok-mono/issues/2983), follow-up
of [#2966](https://github.com/WolfSoko/wol-sok-mono/issues/2966)
([PR #2982](https://github.com/WolfSoko/wol-sok-mono/pull/2982), released
2026-11-09 19:48 UTC). Runs after the orphan cleanup of
[#2986](https://github.com/WolfSoko/wol-sok-mono/issues/2986)
([PR #2993](https://github.com/WolfSoko/wol-sok-mono/pull/2993)).

## Goal

No Korbjäger code, rule, index or text knows the German names of before
#2966 any more. Every account's `auswahl/{uid}` that was not opened since the
release is moved into `selections/{uid}` by a one-off server-side run, so the
removal loses no account's choices.

## Non-goals

- No move of device keys on devices not started since the release: the
  removal drops them (they hold only that device's choices, as the issue
  says).
- No change to what version 3 stores, to the rules of `selections/{uid}` or
  to `deletedAccounts`.
- The production run itself is the owner's (below); this PR builds and tests
  it.
- No removal of the cleanup CLI itself (`src/cleanup/`): it stays as the
  record of the one-off run, as #2986 left it.

## Decisions

- **The migration joins the cleanup CLI as its second step** (owner's
  comment on the issue, #2986's spec). `cleanup-orphans` first deletes the
  orphans, then migrates every remaining `auswahl/{uid}`: one command, one
  report, dry run without `--delete`. Reason: the order is enforced by the
  code, not by the owner remembering it; the CLI already has the project
  guard, the emulator guards and the counts-only report.
- **The move works as the lazy one did, on the admin SDK, one transaction an
  account.** It reads `auswahl/{uid}` and `selections/{uid}`, turns the
  legacy document into version 3 (`legacySelection`), joins it into the
  account's selection (`zusammenfuehren`: the account's entries first, its
  Spitzname winning, only up to the caps), writes only the entries it adds
  (`auswahlFelder`, merged) and deletes `auswahl/{uid}` in the same
  transaction. Reason: same result as opening the account would have given;
  atomic, so a run cut short repeats without a trace. The admin SDK bypasses
  the rules, so the caps are kept by `zusammenfuehren`, not by the rules.
- **A pure Node-safe entry of the lib**:
  `@wolsok/feat-korbjaeger-auswahl/migration` exports one function,
  `legacyMigration(selection, legacy)`, which returns the fields to write
  (or none), what did not fit (counted) and whether the account's document
  is of a newer version (then the run leaves both documents alone and
  counts it). It imports no Firebase. Reason: the functions bundle may not
  pull `firebase/firestore` (the lib's main entry); the mapping, merge and
  caps stay in the lib that owns them. `legacy-selection.ts` moves behind
  that entry; the client-side migration goes.
- **Unreadable legacy documents are deleted, writing nothing**, as the lazy
  move did (`auswahlDokumentLesen` takes them for none).
- **Report counts only, never a uid**: legacy documents found, moved,
  dropped as unreadable, left as newer, entries that did not fit, failed.
  A failure exits 1; a rerun takes the rest.
- **The run happens from the PR branch, before the merge.** The owner runs
  `nx run korbjaeger-functions:cleanup-orphans -- --project=korbjaeger`
  (dry run), then with `--delete`, then the dry run again (expected: 0
  legacy documents), and posts both reports on the PR. Only then is the PR
  merged, since the merge's deploy removes the app's lazy move and the
  rules that let a client read `auswahl/{uid}`. One day after the release
  (2026-11-10 19:48 UTC or later), as the issue asks.
- **The `geloeschteKonten` TTL leaves the index file.** The deploy runs
  `firestore:indexes` without `--force`, so the Firebase CLI keeps a field
  override missing from the file instead of deleting it: the TTL stays live
  for the legacy tombstones written until this deploy (by `kontoGeloescht`)
  and they expire within a day plus TTL's day. Nothing reads them once the
  rules are deployed.
- **Removed** (the issue's list): `legacy-account-migration.ts`,
  `legacy-device-selection.ts` and their exports and specs;
  `LEGACY_DEVICE_KEYS`, `moveLegacyDeviceKeys` and their call in `main.ts`;
  the second key of the theme script in `index.html`; the `auswahl` match
  and the `geloeschteKonten` check in `firestore.rules`; the legacy tombstone
  and the legacy delete in `kontoGeloescht`; the legacy delete in the
  account deletion of `FirebaseKontoDienst`; `LEGACY_DELETED_ACCOUNTS_COLLECTION`;
  the migration sentences of the privacy policy (sections 4 to 6); the
  emulator specs and spec cases of all of these; the docs (`CLAUDE.md`) that
  name them. `LEGACY_CHOICES_COLLECTION` stays only for the CLI (the
  migration reads and deletes it); the orphan step keeps listing it.

## Acceptance

1. `legacyMigration` (spec): a legacy version 1 or 2 document joins into an
   empty and into an existing version 3 selection as `geraetUebernehmen`
   joined it (account first, Spitzname of the account winning, caps), writes
   no field for a list it adds nothing to, returns none for an unreadable
   legacy document and "newer" for a selection of a newer version.
2. The migration step (emulator spec, admin SDK): moves a legacy document
   into a missing and into an existing `selections/{uid}` and deletes it;
   deletes an unreadable one writing nothing; leaves both documents of a
   newer version; dry run changes nothing and counts the same; the report
   holds counts only.
3. The CLI runs the orphan step first, then the migration; `--delete`
   applies both; the report shows both steps.
4. No source, rule, index or spec of `korbjaeger`, `korbjaeger-functions`,
   `feat-korbjaeger-auswahl` or `feat-shared-korbjaeger-account` names
   `geloeschteKonten`, `korbjaeger-auswahl` (device key), the other device
   keys of before #2966 or the lazy move; `auswahl` remains only in the
   account lib's constant and the CLI.
5. The privacy policy no longer mentions the move of earlier versions'
   data (sections 4 to 6); its spec passes.
6. `test`, `test-emulator`, `typecheck-specs`, `lint`, `lint-templates` and
   `build` of the affected projects pass; `korbjaeger:e2e` passes.
7. Before the merge: the owner's dry run and `--delete` run on production
   are posted on the PR, the second dry run counts 0 legacy documents.

## Open questions

- None blocking. If the owner prefers the removal in a second PR after the
  run from `main`, the CLI part ships first and the rest follows; the spec
  holds either way.
