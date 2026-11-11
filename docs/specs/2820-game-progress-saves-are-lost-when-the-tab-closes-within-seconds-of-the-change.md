# Spec: game progress saves survive a tab closed within seconds of the change

Issue: [#2820](https://github.com/WolfSoko/wol-sok-mono/issues/2820). Found while diagnosing [#2817](https://github.com/WolfSoko/wol-sok-mono/issues/2817).

## Problem

`FirestoreGameStorage.update` runs every change of the player's progress as a queued Firestore transaction. A transaction lives only in the page: unlike a plain write it never reaches Firestore's persistent cache before the server committed it. A tab closed or reloaded before that drops the change, online too:

- a daily attempt counted as a match starts (`ProgressService.startDailyAttempt`), a medallion, a match's totals, an evolution purchase;
- the progress this device kept before the cloud: `playerDocument`'s `deviceCopy` adopts it into the cloud and clears the device's copy **at once**, before the cloud has it, so that progress can be lost for good.

## Goal

1. A change of a player's document (`playerDocument`: progress, evolution) that has not reached the cloud when the page goes is applied again on the next visit of the same player on this device.
2. The device's progress from before the cloud is cleared only once the cloud has it.

## Non-goals

- A `beforeunload` guard ("Leave site?"). It nags every close while offline or banned (the queue waits then), and mobile browsers rarely fire it.
- Making the guest's adoption into a signed-in account durable (`switchTo` with `adoptsGuest`). The guest's own cloud document keeps that progress; its loss on a closed tab is a separate, rarer case (raised as a follow-up).
- Changing how the documents are stored in Firestore (field transforms, plain writes instead of transactions).
- The local-only game (no cloud): `LocalGameStorage` writes synchronously, nothing to lose.

## Decisions

1. **Journal the held value, not the change.** A change is a closure and cannot be stored. What a `playerDocument` holds after a change (`value`) is a join of every change and stored value (`merge` can only gain, see `mergeProgress`/`mergeEvolution`), so writing `merge(stored, held)` later lands what the change would have, and doing it twice changes nothing. That makes replaying safe in every crash window, unlike replaying a change that adds to a count.
   - Bounded loss: a total takes the higher of the stored and the journalled one (as `mergeProgress` does today), so matches another device counted meanwhile and the journalled ones are not added up. Accepted: it only happens when the tab closed before the commit and another device played meanwhile.
2. **Where:** in `DeviceStorage` (the browser's local storage) under `<key>.unsaved`, a map of entries `{ [entryId]: { player, value } }`, the entry id being `<page id>:<player id>`. One entry per page and player, so two tabs never clear each other's entry. Changed through `DeviceStorage.update` (Web Locks, as every local read-modify-write).
3. **When written:** with every `apply` while a player is known and the game has a cloud. Not for the device-only game.
4. **When cleared:** when the storage reports the latest change of this page for that player stored. A change it dropped for good (the rules refuse it, say as the player signed out before it ran) moves to an entry of its own that the page never clears, for the player's next start here: a later change that is stored carries only its own part (`ProgressService` adds a match's counts), not the dropped one's. The page's entry holds everything it kept for the player since its last stored change, merged. To know that, `GameStorage.update` returns a `Promise<boolean>`: true once stored, false once dropped; it never rejects. `LocalGameStorage` resolves after its write, `FirestoreGameStorage` after the transaction's commit, `LateGameStorage` on `flush`.
5. **Replayed:** when a player starts (first player and every switch), every entry of that player from other pages (a closed tab's, or one of a tab still open, which is harmless as the replay is idempotent) is merged into what is held and applied as a change of this page, kept as this page's own entry; once that is on the device, the entries read are removed, each only while it still holds what was read (a tab still open may have written it again meanwhile, and that newer value stays).
6. **The device's copy before the cloud** is adopted as before (`adopt`, counts added once), and first kept as an unsaved change of the page, then cleared from the device at once (as before; where the device refuses the journal, only once the adoption is stored), so a second page starting meanwhile never adopts it too. A page closed before the cloud stored the adoption leaves it in the journal, and the next visit lands it through `merge`: never counted twice, but its totals then take the higher of the stored and the copy's rather than adding up (decision 1). Remaining window: the few milliseconds between the journal write and the clearing, in which a second page starting would adopt the copy too.
7. Entries of a player who never returns stay on the device. They are small (one progress or evolution JSON) and exist only for changes that never reached the cloud.

## Acceptance

1. With a cloud, a change made through `playerDocument.apply` whose storage never answers leaves an entry under `<key>.unsaved` holding the held value and the player id.
2. Once the storage answers for the latest change, the page's entry is gone; an earlier change answering while a later one waits leaves it.
3. A new `playerDocument` for the same player with such an entry on the device holds the entry's value merged in at once and stores `merge(stored, entry)`; once stored, the entry is gone.
4. An entry of another player is neither applied nor removed.
5. Replaying twice (the first replay stored, the page then closed before the entry was removed) changes nothing stored.
6. The device's copy before the cloud leaves the device as it is adopted and waits under `<key>.unsaved` until the adoption is stored; a second page starting meanwhile adopts nothing; the next visit lands it when the cloud never stored it. A change the storage dropped keeps its entry.
7. `GameStorage.update` resolves true once stored and false when dropped for `LocalGameStorage`, `FirestoreGameStorage` (commit, final error) and the spec fake; it never rejects.
8. Without a cloud nothing is journalled.
9. Existing specs of the game lib, its `typecheck-specs`, lint and the game's e2e stay green.

## Open questions

None blocking. Whether to add an e2e that reloads right after a match without waiting for the save (the reverse of #2817's wait) is left to the plan: the unit specs cover the journal; the e2e would need the tab to be closed before Firestore commits, which the emulator does too fast to make it reliable.
