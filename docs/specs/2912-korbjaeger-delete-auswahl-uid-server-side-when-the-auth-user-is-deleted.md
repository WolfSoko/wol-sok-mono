# Spec #2912: Korbjäger: delete auswahl/<uid> server-side when the Auth user is deleted

Found on PR [#2911](https://github.com/WolfSoko/wol-sok-mono/pull/2911)
([#2873](https://github.com/WolfSoko/wol-sok-mono/issues/2873)). Part of
[#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861).

## Goal

Once an Elternteil's account is deleted, nothing of `auswahl/{uid}` is left
in Firestore, also when a second device signed in to the same account keeps
writing during and after the deletion. Today the client deletes the
document and then the Auth user; the other device's ID token stays valid for
up to an hour, the rules cannot tell it from a live one, and the document
can come back. Then the privacy policy (section 6) can promise the deletion
without the "write me an e-mail" exception.

## Non-goals

- No change to the client's deletion flow (`KontoSitzung`, the settings'
  dialog): it still deletes `auswahl/{uid}`, waits for the server and then
  deletes the Auth user. The function is the guarantee behind it, not a
  replacement.
- No Sentry for the new functions (Korbjäger has no Sentry project); errors
  go to Cloud Logging and the retries.
- No revoking of refresh tokens: a deleted user's tokens cannot be refreshed
  anyway, and revocation does not reach the Firestore rules.
- The rest of the privacy policy's work in
  [#2874](https://github.com/WolfSoko/wol-sok-mono/issues/2874) stays there;
  this PR only rewrites what section 6 says about the deletion.

## Decisions

- **A new Nx app `korbjaeger-functions`** (`apps/korbjaeger-functions`, tags
  `app`, `type:firebase`, `type:functions`), built as
  `bacteria-wars-functions` is: `@nx/esbuild`, ESM, `thirdParty: false`, its
  own `package.json` with `firebase-admin` and `firebase-functions` at the
  workspace's versions (kept equal by `package-json.spec.ts`), Jest specs. The
  Nitro function is Analog's build output and cannot carry a trigger.
- **A codebase of its own in `firebase.korbjaeger.json`**: `functions`
  becomes a list, the Nitro server as codebase `default` (unchanged, so
  Firebase keeps the deployed `server`), the new app as codebase `konto`
  with the `npm install --legacy-peer-deps=false` predeploy (kept by
  `firebase-deploy.spec.ts` in both apps). `korbjaeger:deploy` deploys
  `functions:default`, `korbjaeger-functions:deploy` deploys
  `functions:konto` with `--force` and sets the artifact policy of
  `europe-west3`; both in the `non-cdk` leg of `deploy.yml`, which runs every
  affected `deploy` target.
- **Region `europe-west3`**, next to the database (owner's note on the
  issue), not `europe-central2` as the issue first proposed. The functions'
  `REGION` is checked against `REGIONEN.firestore` in
  `apps/korbjaeger/src/shared/regionen.ts` by a spec reading that file, since
  an app imports no other app.
- **A 1st-gen trigger** (`firebase-functions/v1`,
  `auth.user().onDelete`): 2nd-gen functions have no Auth deletion event,
  only blocking functions for creation and sign-in. Bacteria Wars does the
  same.
- **A tombstone closes the window**: deleting the document alone does not,
  because the other device may write again right after. The trigger first
  writes `geloeschteKonten/{uid}` (`{ expireAt }`, a day after the deletion)
  and then deletes `auswahl/{uid}`. The rules refuse every request on
  `auswahl/{uid}` while `geloeschteKonten/{uid}` exists (`exists()` in
  `istBesitzer`), and clients can neither read nor write
  `geloeschteKonten`. A write evaluated before the tombstone is deleted by
  the step after it; every write after it is refused. This rests on
  Firestore committing a write together with the documents its rules read
  (the `exists()` belongs to the write's transaction), which the serial
  emulator cannot show. A day is longer than
  any ID token lives (an hour), and a deleted user's token cannot be
  refreshed, so once the tombstone expires no token of that uid is left.
- **The tombstone expires by Firestore's TTL**: a `fieldOverrides` entry
  with `ttl: true` on `geloeschteKonten.expireAt` in a new
  `apps/korbjaeger/firestore.indexes.json`, deployed with the rules
  (`firestore:rules,firestore:indexes`). It holds the uid only, no
  choices, and the privacy policy names it, with the up to one more day
  TTL takes to delete an expired document. The function's log line names no
  uid, as Cloud Logging keeps it 30 days.
- **No implicit dependency on `korbjaeger`**: it would redeploy the
  functions with every app release. The tombstone's rules cases stay in the
  app's own rules suite, which a rules change reruns; the functions' race
  spec reads the rules file as a target input.
- **Retries on**: the trigger runs with `failurePolicy: true` (retried for
  up to 7 days) and is idempotent: `set` of the tombstone and `delete` of a
  document that may be gone already both succeed on a rerun.
- **The handler is a pure function of a narrow port** (`kontoGeloescht(db,
  uid, now)` on admin Firestore), so the emulator spec runs it without the
  Auth emulator, as Bacteria Wars' erasure specs do.

## Acceptance

1. Deleting the Auth user of an account deploys a trigger that writes
   `geloeschteKonten/{uid}` with `expireAt` one day after its run and then
   deletes `auswahl/{uid}` (spec of the handler, emulator).
2. Emulator test with two devices of one account: device A deletes the
   document, device B keeps writing Teams in a loop while the handler runs;
   once the handler finished, `auswahl/{uid}` does not exist, and every
   write of B after it is refused.
3. A rerun of the handler (a retry) after a successful one, or after one
   that failed between its two steps, ends in the same state without error.
4. The rules: an owner is refused `get`, `create`, `update` and `delete` on
   `auswahl/{uid}` while `geloeschteKonten/{uid}` exists; nobody can read or
   write `geloeschteKonten/{uid}` from a client; every existing rules case
   still passes.
5. `firebase.korbjaeger.json` has both codebases with the predeploy flag;
   `korbjaeger:deploy` deploys `functions:default`, hosting, rules and
   indexes; `korbjaeger-functions:deploy` deploys `functions:konto`; the
   TTL override exists (specs).
6. The functions' `REGION` equals `REGIONEN.firestore.id`; their
   `package.json` versions equal the workspace's (specs).
7. Section 6 of the privacy policy says the server deletes the document when
   the account is deleted, without exception, and names the tombstone (the
   uid kept a day); `CLAUDE.md` describes the new app.
8. `build`, `test`, `lint`, `test-emulator` of both apps pass.

## Open questions

- None blocking. The first deploy of codebase `konto` uses the Cloud
  Functions and Cloud Build APIs the Nitro function's deploy already enabled
  in project `korbjaeger`; if the release's deploy reports a missing API or
  permission, that is a manual step for the owner.
