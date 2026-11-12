# Spec #3011: Korbjäger: English identifiers, part C: korbjaeger-functions

Issue: [#3011](https://github.com/WolfSoko/wol-sok-mono/issues/3011), part C
of [#2967](https://github.com/WolfSoko/wol-sok-mono/issues/2967). The rules
for every part (goal, non-goals, vocabulary, decisions, acceptance) are
[#2967's spec](2967-korbjaeger-rename-the-german-identifiers-in-code-to-english.md);
this spec only adds what is particular to part C. The map is part C's section
of [#2967's plan](../plans/2967-korbjaeger-rename-the-german-identifiers-in-code-to-english.md).

## Goal

Every name declared in `korbjaeger-functions` (`apps/korbjaeger-functions`)
is English. Part A already renamed the basketball data the club index reads
and part B the libs; what is left is German in the account deletion and its
specs:

| Old                                                  | New                                      |
| ---------------------------------------------------- | ---------------------------------------- |
| the deployed function `auswahlLoeschen` (`main.ts`)  | `deleteSelection`                        |
| `kontoGeloescht` in `konto-geloescht.ts`             | `accountDeleted` in `account-deleted.ts` |
| `konto-geloescht.emulator.ts` and the names it holds | `account-deleted.emulator.ts`, English   |
| the local `konto` of `package-json.spec.ts`          | `functionsCodebase`                      |

## Non-goals

As #2967's spec. In particular:

- **The codebase stays `konto`.** It is a deployed name: `--force` deletes
  only the functions of the codebase it deploys, so a codebase of another
  name would leave `auswahlLoeschen` running under `konto` for good, beside
  its successor. `firebase.korbjaeger.json`, the `deploy` target and their
  specs keep it.
- **Persisted names stay**: the collections (`selections`,
  `deletedAccounts`, `clubIndex`, `auswahl`) and their fields come from
  `feat-shared-korbjaeger-account`, English already except the legacy
  `auswahl`, which stays as stored.
- **Fixture proper names stay**: the Verbände `BAYERN`, `BERLIN` and
  `HESSEN` of the club index's specs are names of real Verbände, as the
  Vereine part B kept (`MTV_GIFHORN`).
- **Earlier specs and plans** (#2912, #2966, #2983, #2986) are records of
  their issue and keep the names they were written with.

## Decisions

- **The deployed function is renamed.** Renaming an export replaces the
  function in production; that is safe here because:
  - the Firebase CLI creates and updates every function of a deploy first
    and deletes the ones gone from `main.ts` only when all of those
    succeeded (`firebase-tools`' `Fabricator.applyPlan`: upserts, then
    "Deploys failed. Skipping deletes."), so an Auth deletion is never
    without a trigger: for the seconds between the two steps both run;
  - `accountDeleted` is idempotent (tombstone `set`, then `delete`), so an
    account deleted in that window and handled by both ends the same;
  - a deletion event the old function failed on and still retries when
    the deploy deletes it loses its remaining retries; the client deleted
    `selections/{uid}` before the Auth user already, and the window is
    seconds, so at most a document another device wrote in that hour is
    left, which a run of the one-off orphan cleanup (`src/cleanup/`) removes;
  - a failed deploy keeps the old function (no delete), and
    `tools/deploy/retry-once.ts` runs it again.

  Keeping the German export would leave the one name Firebase shows in the
  console, the logs and the deploy output German for good, which Rule 10
  rules out for every non-persisted name. A function name is not persisted
  data: nothing reads it back.

- **`deleteSelection`** says what the trigger does (it deletes the
  deleted account's selection, `CHOICES_COLLECTION`); **`accountDeleted`**
  keeps the handler's form (an event handler named by its event, as
  `kontoGeloescht` was).
- **The log line** "Auswahl of a deleted account deleted" becomes
  "Selection of a deleted account deleted": no alert or metric reads it
  (`git grep` finds it only in `main.ts`).
- **Comments in other projects** that quote the handler (`firestore.rules`,
  the app's `firestore-rules.emulator.ts`, `firebase-deploy.spec.ts`,
  `datenschutz.component.spec.ts`) and `CLAUDE.md` name the new
  identifiers. The app's own `auswahlLoeschen` (`KontoDienst`) is another
  name, renamed in part D.
- **Test data** in the emulator spec follows the names: the uids
  `elternteil-a`/`-b` become `parent-a`/`-b` (values no code reads back).

## Acceptance

#2967's acceptance 1 to 5 for `korbjaeger-functions`, and:

6. `main.spec.ts` names the exports `deleteSelection` and `clubIndex`, the
   former still an Auth deletion trigger in `REGION`, retried.
7. `korbjaeger-functions:test-emulator` passes: the renamed handler writes
   the tombstone and deletes the selection, idempotent, under writes of a
   second device.
8. `git grep -E 'kontoGeloescht|konto-geloescht|auswahlLoeschen' -- ':!docs'`
   finds only the app's own `KontoDienst.auswahlLoeschen` and its specs
   (part D); under `docs/` the names stay in the specs and plans of
   earlier issues and in this spec and part C's map, which quote them.

## Open questions

None.
