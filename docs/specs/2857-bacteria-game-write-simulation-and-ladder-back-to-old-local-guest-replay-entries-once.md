# Spec #2857: bacteria-game: write simulation and ladder back to old local guest replay entries once

Follow-up of [#2828](https://github.com/WolfSoko/wol-sok-mono/issues/2828) /
PR [#2856](https://github.com/WolfSoko/wol-sok-mono/pull/2856).

## Goal

A guest's replay entry kept before `LocalGameReplays` wrote `simulation`
(and `ladder`) is read from its bytes **once**: the store writes the fields it
read back into the stored entry, so later listings of "My matches" read
nothing but the stored fields. Today `keptListingOf`
(`libs/features/lazy/bacteria-game/src/lib/storage/local-game-replays.ts`)
inflates, parses and checks the whole replay of every such entry (up to 20,
about 1 MB) on every listing, until those entries age out.

## Non-goals

- No change to the Firestore backend (`CloudGameReplays`): its records carry
  `simulation` since PR #2856.
- No change to the playback rule (`storedPlaybackOf`, `storedPlaybackRefusal`)
  or to what "My matches" shows.
- No change to the caps (`MAX_LOCAL_REPLAYS`, `MAX_LOCAL_REPLAY_CHARS`).

## Decisions

- **The migration sits in the store's read path (`LocalGameReplays.read`),
  not in the listing.** The first try in PR #2856 (`keepPlayback`) wrote from
  inside `keptListingOf`, a listing with a write side effect, and was removed
  by `/simplify`. `read()` is where the store turns storage into its entries;
  there, upgrading old entries to the current shape is part of reading them.
  `listMine` then works on entries that always have `simulation`;
  `replayBytes` needs only the bytes and reads the stored entries as they are.
- **One `storage.update` for all old entries found in one read, with a pure
  `change`.** The bytes are inflated before the write (async); the `change`
  passed to `update` only merges the already read playback fields into the
  entries that still lack them, so it may run more than once (as
  `GameStorage.update` allows) and two concurrent reads write the same.
  An entry that gained `simulation` meanwhile, or was deleted, is left as it
  is.
- **An entry whose bytes do not read is removed from storage, not marked.**
  Nothing can use it: "My matches" leaves it out today and the viewer cannot
  play its bytes. A marker would keep a dead entry in the 20-replay and
  1 MB caps until it ages out, and add a field to the stored shape only to
  say "ignore me". The issue suggested marking; removing gives the same
  one-time cost with less state.
- **The read's own result carries the migrated entries**, so the first
  listing after the update is already complete and does not wait for the
  storage to answer the write.
- **`keptListingOf` goes away**: a listing is the entry without its `bytes`.

## Acceptance

1. Listing a store holding an old entry (no `simulation`, readable bytes)
   returns it with `simulation` and `ladder` from its bytes, as today.
2. After that listing, the stored entry carries `simulation` (and `ladder`
   where the replay has one); its other fields and bytes are unchanged.
3. A second listing reads no bytes: with the bytes spoiled after the
   backfill, the entry is still listed (the engine's exports cannot be
   spied on under ts-jest, so the spec checks it by behaviour).
4. An old entry whose bytes do not read is left out of the listing, as
   today, and is gone from storage after it.
5. Entries that already have `simulation` are neither re-read nor rewritten;
   a store without old entries triggers no `update` at all on listing.
6. The `change` passed to `update` leaves an entry that gained `simulation`
   meanwhile, or was deleted meanwhile, as it is (unit test on the pure
   function).
7. `npx nx test feat-lazy-bacteria-game`, `typecheck-specs`, lint,
   lint-templates and format pass.

## Open questions

None.
