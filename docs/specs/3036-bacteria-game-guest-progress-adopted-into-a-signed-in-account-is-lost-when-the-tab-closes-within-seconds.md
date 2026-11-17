# Bacteria game: guest progress adopted into a signed-in account is lost when the tab closes within seconds

Issue: [#3036](https://github.com/WolfSoko/wol-sok-mono/issues/3036)

## Goal

A guest who signs in on this device to a Google account that already played elsewhere gets their
guest progress (`bacteria-game.progress`, `bacteria-game.evolution`) added to the account exactly
once, even when the tab closes before Firestore stored that adoption. The adoption that did not
land runs again on the account's next start on this device; one that did land never runs twice.

## Why it is lost today

`playerDocument`'s `switchTo` (`libs/features/lazy/bacteria-game/src/lib/storage/player-document.ts`)
queues `storage.update(key, stored => adopt(stored, guest))` in `FirestoreGameStorage`. The queue
lives as long as the page. `adopt` adds counts, so the unsaved-changes journal of
[#2820](https://github.com/WolfSoko/wol-sok-mono/issues/2820), which replays a held value through
`merge`, cannot carry it: replaying an addition that did land counts it twice, and merging the
held value instead loses the guest's counts. After the switch the account cannot read the guest's
document (the rules allow only its owner), so nothing can recover it from the cloud either.

## Non-goals

- Adopting on another device: the pending adoption stays with the device that signed in.
- The device's pre-cloud copy (`deviceCopy`) keeps its own handover through the unsaved-changes
  journal.
- No change to how `adoptProgress`/`adoptEvolution` combine values.
- A pending adoption still waiting after 20 later adoptions of the same account on other
  devices could land twice, as the document keeps the last 20 ids only. Accepted: it needs 21
  sign-ins that adopt, elsewhere, before this device starts the account again.

## Decisions

1. **An idempotent change in the storage, keyed by an id.** `GameStorage.update` takes an optional
   `{ once: id }`. `FirestoreGameStorage` keeps the ids of such changes in the document beside
   `json` (`applied`, a list of the last `APPLIED_LIMIT` = 20 ids, newest last); its transaction
   skips a change whose id is listed and lists the id with the write. Every write keeps the list:
   `update` carries it over, `write` merges (`setDoc` with `merge`) rather than replacing. Reason:
   only the transaction that writes the counts can say atomically whether they landed; a marker
   anywhere else (another document, the device) can disagree with the data.
2. **The rules take the list.** `isStoredValue` in `apps/bacteria-game-remote/firestore.rules`
   allows `applied` as an optional list of at most 20 ids (1-100 letters, digits, dashes, checked
   over the joined text; a number passes, as `join()` writes its digits, and the client reads
   strings only). A write that drops a listed `applied` is refused (`keepsAppliedIds`): a client
   of an older release replaces the document whole, which would let a pending adoption land
   twice; its refused change stays in its device's unsaved-changes journal for the next visit.
   A change made once is listed even where it changed nothing, so a later value it would change
   does not make it again. It deploys with the hosting deploy,
   in the same release as the client.
3. **A device journal of pending adoptions.** Beside the key, under `<key>.adoptions`
   (`pendingAdoptionsKey`) in `DeviceStorage`: per adoption id `{ player, value }`, the account
   it joins and the guest's value as the page held it. That is the shape of an unsaved change,
   so the journal reuses the pure functions of `unsaved-changes.ts` under its own key rather
   than copying them. `switchTo` records the entry, runs the adoption with `once: id`, and
   removes the entry once the update resolved true. One resolving false stays for the account's
   next start: the main cause is the rules refusing it after a sign-out, and the account can
   still take it later; replaying by id is safe. The device's privacy
   policy (section 3, both languages) names this copy.
4. **Replayed on the account's next start here.** Whenever a player starts with the cloud
   (`account.players`), every pending adoption of that player is run again with its id, and
   removed once stored. Two tabs replaying the same entry, or a tab replaying while the original
   page is still open, land it once: the transaction sees the id. The `LocalGameStorage` backend
   lands a change at once and never adopts (no cloud, no switch), so it ignores `once`.
5. **Ids** come from `crypto.randomUUID()`, with the page id's fallback.

## Acceptance

1. A sign-in that adopts records a pending adoption on the device before the adoption is stored,
   and removes it once `update` resolved true; a dropped one stays for the next start.
2. A page that starts as a player with a pending adoption for them runs it with its id and then
   removes it; one of another player stays.
3. `FirestoreGameStorage.update` with `once` skips a change whose id the document lists, lists the
   id after applying, keeps at most 20 ids, and keeps the list on every later `update` and `write`.
4. The rules accept a stored value with `applied` (list of up to 20 ids), also through a merged
   write, and refuse one with more than 20, a non-list, an empty id, an id with a comma or one
   over 100 characters.
5. Existing specs of `player-document`, `firestore-game-storage` and the rules stay green.

## Open questions

None.
