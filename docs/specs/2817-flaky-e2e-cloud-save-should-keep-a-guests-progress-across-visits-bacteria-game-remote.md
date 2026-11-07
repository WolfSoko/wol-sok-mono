# Flaky e2e: cloud-save "should keep a guest's progress across visits"

Issue: [#2817](https://github.com/WolfSoko/wol-sok-mono/issues/2817), found on main run [42285376708](https://github.com/WolfSoko/wol-sok-mono/actions/runs/42285376708) (6f1f5ba).

## What failed

The issue says the card read "3 of 3 attempts left" right after `useDailyAttempt`. The job log says otherwise: on all three tries the check before the reload passed, and the one **after** `page.reload()` failed (`cloud-save.spec.ts:77`, `expectAttemptsLeft` called from the line after the reload):

```
Expected substring: "2 of 3 attempts left"
Received string:    "…Daily level…3 of 3 attempts left"
  at expectAttemptsLeft (cloud-save.spec.ts:53:33)
  at cloud-save.spec.ts:77:5
```

So the attempt was counted in the page (`ProgressService.startDailyAttempt` updates the progress signal at once), but the reloaded page read a cloud copy without it.

## Cause

`ProgressService.store` saves the attempt through `GameStorage.update`, which `FirestoreGameStorage` runs as a Firestore **transaction**, queued per key behind the writes before it. A transaction lives only in the page: it is not in Firestore's persistent cache until the server committed it, and the class comment says a queued change is lost when the page closes first. The test reloads a few seconds after the match started, as soon as the menu is back. On a busy CI worker (the match, the vaporize animation and three other spec files on the same agent) the transaction had not committed by then, the reload dropped it, and the reloaded page read the progress without the attempt. On the runs before and after, the commit won the race.

## Goal

The guest test checks what it is named for, progress kept from one visit to the next, without racing the save: the next visit starts only once the progress is in the cloud.

The third test, "should take the progress this device kept before into the cloud", needs no change: the adoption (`playerDocument`'s `adoptOnce`) only queues the transaction and never sets the page's value, which comes from storage snapshots alone. So the medallion the test waits for in the profile before its reload already shows that the cloud has it.

## Non-goals

- No change to `FirestoreGameStorage` or `ProgressService`. Keeping a queued transaction across a page close (for a player who closes the tab within seconds of starting a match) is a product question of its own; it is raised to the manager as a follow-up, not decided here.
- The second and third tests of `cloud-save.spec.ts` stay as they are: the second's first page never reloads or closes before the other device has read the attempt, and the third already waits for a value only a committed save shows (see Goal).

## Decisions

- **Wait for the save through the game, in a second tab of the same browser context.** A second tab is a second visit of the same guest (the auth state lives in the context's IndexedDB) that reads the progress from the cloud, while the first tab stays open and its queued transaction can commit. `expectAttemptsLeft` there waits (15 s, the spec's `expect` timeout) until the attempt has landed. Only then the second tab closes (two games on a busy worker would slow the checks that follow) and the first tab reloads and checks again, so the reload never cuts a pending save off.
  - Rejected: reading the document over the emulator's REST API (as `fixtures/friend-mirror.ts` does). It needs the guest's uid from IndexedDB and ties the test to the storage layout (`players/{uid}/storage/bacteria-game.progress`, the JSON inside), while the second tab checks what the player sees.
  - Rejected: polling with reloads until the card reads 2. The first reload drops the pending transaction for good, so the loop could only pass by luck.
  - Rejected: a longer fixed wait before the reload. It only moves the race.
- **One helper for a visit in another tab**, `visitAgain(page)` in the spec, returning the new page and its `BacteriaGamePo`, so the test reads as the scenario it is.
- **The comment at the reload says why the order matters**, so nobody puts the reload back first.

## Acceptance

1. In `cloud-save.spec.ts`, "should keep a guest's progress across visits" checks the attempts in a second tab of the same context, and closes it, before the first tab reloads.
2. The test passes locally on Chromium, also with the page's CPU throttled (CDP `Emulation.setCPUThrottlingRate`, rate 6) for one run, where the old order is shown to fail or to be at risk (attempt not yet stored at the moment of the reload).
3. The whole spec file passes 10 times in a row locally (`--repeat-each=10`, Chromium).
4. The whole `cloud-save.spec.ts` passes in CI (`bacteria-game-remote:e2e-ci--e2e/cloud-save.spec.ts`).
5. Format and lint pass on the changed files.

## Open questions

None.
