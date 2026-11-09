# Spec #2986: Korbjäger: delete orphaned selections/{uid} and auswahl/{uid} of deleted accounts

Issue: [#2986](https://github.com/WolfSoko/wol-sok-mono/issues/2986), sub-issue
of [#2983](https://github.com/WolfSoko/wol-sok-mono/issues/2983). Found while
merging [PR #2982](https://github.com/WolfSoko/wol-sok-mono/pull/2982)
([#2966](https://github.com/WolfSoko/wol-sok-mono/issues/2966)).

## Goal

No Korbjäger document outlives its account. During #2982's deploy window the
old deletion function (tombstone in `geloeschteKonten`, deletes only
`auswahl/{uid}`) may have been live next to the new app, so an account deleted
then can have left `selections/{uid}` behind; a device with a still valid
token could also have recreated either document. A one-off run finds every
`selections/{uid}` and `auswahl/{uid}` whose Auth user no longer exists and
deletes it, with a dry run that only counts first.

## Non-goals

- No migration of `auswahl/{uid}` of accounts that still exist: that is
  #2983's step 1. This run leaves them alone.
- No removal of transitional code (#2983's step 2).
- No scheduled or deployed function: the run is one-off, started by the owner.
- The production run itself is not part of this PR: it deletes production
  data, needs the owner's approval and production credentials, and runs
  together with #2983's migration (below).

## Decisions

- **Code in `korbjaeger-functions`, not deployed.** `src/cleanup/` holds the
  logic and a small CLI; `main.ts` does not export it, so no deploy carries
  it. Reason: the app already depends on `firebase-admin`, has the emulator
  project with the app's real rules, and owns the deletion (`kontoGeloescht`);
  `tools/` may import no app.
- **An orphan is deleted as a deleted account is: through `kontoGeloescht`.**
  Each orphaned uid gets the tombstones (TTL a day) and both documents
  deleted. Reason: one way to delete an account's data, idempotent, and the
  tombstone stops a device whose token is still valid from writing the
  document anew while the run deletes it.
- **Auth decides with `getUsers`, 100 uids a call** (the admin SDK's limit).
  A uid in `notFound` is orphaned; any error of the lookup stops the run
  before anything is deleted for that batch. The lookup is a port
  (`ExistingAccounts`), the admin Auth its one adapter, so the logic is
  testable without the Auth emulator; the emulator spec runs the real
  adapter against the Auth emulator too.
- **Dry run by default.** The CLI deletes only with `--delete`; both modes
  print the same report: documents read per collection, orphaned uids found,
  uids deleted. Counts only, never a uid (the privacy policy promises no
  stored trace of a deleted account).
- **Project named explicitly.** The CLI requires `--project` (no default, no
  fallback to an environment project) and refuses to run without it, so a
  run against production is always spelled out; against the emulators it
  runs inside `firebase emulators:exec`, which sets the hosts.
- **Order with #2983's run.** The orphan cleanup runs first, then #2983's
  migration, so the migration never moves an orphan's `auswahl/{uid}` into
  `selections/{uid}`. #2983's step joins this CLI as a second step (one
  command, one report) when it is built.

## Acceptance

1. `findOrphanedAccounts` returns exactly the uids of `selections` and
   `auswahl` documents whose Auth user is missing, each once, also when a uid
   has both documents and when there are more than 100 uids.
2. `cleanUpOrphanedAccounts` in dry-run mode deletes nothing and reports the
   counts; with deletion on it removes both documents of each orphan, leaves
   a tombstone, and leaves the documents of existing accounts unchanged.
3. A failing account lookup deletes nothing.
4. The emulator spec runs the real Auth adapter against the Auth emulator
   (existing user kept, missing user deleted).
5. `nx run korbjaeger-functions:cleanup-orphans -- --project=<id>` runs the
   CLI (dry run), `--delete` deletes; the report holds counts only.
6. `main.ts` exports no cleanup; `test`, `test-emulator`, `lint`,
   `typecheck-specs` and `build` stay green.
7. The PR reports the emulator dry-run and deletion counts; #2983 notes the
   production run (dry run, then `--delete`, counts before and after).

## Open questions

- Decided (request 815): #2986 stays open (the PR says `Refs #2986`) until the owner's production run; the PR gives its commands.
