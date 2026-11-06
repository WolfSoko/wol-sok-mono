# Spec #2786: `playerDocument<T>()` for data that follows the player

Candidate 10 of [#2776](https://github.com/WolfSoko/wol-sok-mono/issues/2776),
see [`docs/bacteria-game/architecture-deepening.md`](../bacteria-game/architecture-deepening.md).

## Goal

`ProgressService` and `EvolutionService` each run the same pipeline over
`GameAccount.players` and `GameStorage`: follow the players, start over on a
switch (adopting the guest's data on `adoptsGuest`), move the device copy
over to the first cloud player once, track a loaded flag, merge what the
storage tells and write changes. One function in the game lib,
`playerDocument<T>()` (`src/lib/storage/player-document.ts`), owns that
pipeline; both services hold a document and keep only their domain rules.
A new player-data service then gets the switch, the guest adoption and the
device move by creating a document, not by writing the pipeline again.

## Non-goals

- No change to what is stored, under which key, or to the engine's merge
  and adopt functions (`mergeProgress`, `adoptProgress`, `mergeEvolution`,
  `adoptEvolution`, ...). The engine is untouched: goldens stay byte-equal,
  no `BALANCE_VERSION` bump.
- No change to `GameAccount`, `GameStorage`, `DeviceStorage` or their fakes.
- No other service moves onto the document in this change (the settings
  stay with the device and do not follow the player).

## Interface

```ts
interface PlayerDocumentOptions<T> {
  key: string; // the GameStorage key
  parse: (stored: unknown) => T; // the key's parser
  empty: T; // what a new player holds
  merge: (held: T, stored: T) => T; // what the storage tells, merged into what is held
  adopt: (stored: T, guest: T) => T; // a guest's or the device's data joining the stored
  equal?: (a: T, b: T) => boolean; // same value: no signal change, no adopting an empty value
  onSwitch?: () => void; // another player took over
  onStored?: (value: T, apply: PlayerDocument<T>['apply']) => void; // after each value the storage told
}

interface PlayerDocument<T> {
  readonly value: Signal<T>;
  readonly loaded: Signal<boolean>; // the storage answered for the current player
  apply(value: T, write: (stored: T) => T): void; // hold `value` here, write `write(parse(stored))`
}
```

`playerDocument(options)` runs in an injection context (a service's field
initialiser) and stops with it (`takeUntilDestroyed`).

## Decisions

- **`apply(value, write)` rather than `apply(change)`.** The issue sketched
  one `change`, but the two services write differently: evolution applies a
  change to the stored value merged with the held one, progress adds a
  match's counts to the stored value and merges the gains, a reset raises
  the epoch over the stored value. The document holds the value and parses
  the stored one; what the write does stays the service's domain rule.
- **A switch always starts from `empty`.** Today the progress keeps the
  guest's progress in view while an adopting switch waits for the account's
  storage; the evolution starts empty. Both hold `loaded` false meanwhile,
  and the stored value they merge in already holds the adopted guest's
  data, so the document starts empty for both: nothing of one player shows
  as another's, as `GameAccount` asks.
- **Adopting an empty value is no write** (`equal(guest, empty)`, by
  default `Object.is`), as the evolution does today: the storage is not
  called without a change.
- **Two hooks, no subclassing.** `onSwitch` serves the evolution (its
  Start timer and the trusted skin pick start over); `onStored` serves both:
  the evolution stops trusting the pick, the progress earns what the stored
  progress earns on its own and writes it back. `onStored` gets `apply` as
  an argument, since the storage may answer while the document is still
  being created.
- **The pipeline is tested once**, in `player-document.spec.ts`, against
  `FakeGameAccount` and `LateGameStorage`: first load, loaded flag, merge,
  `equal`, `apply`, switch, adopt (and no adopt of an empty value), the
  device move (once, only with the cloud), the hooks. The service specs drop
  their pure pipeline cases ("starts over", "own storage", "device copy")
  and keep the domain ones, guest adoption included, since that tests
  `adoptProgress`/`adoptEvolution` as wired.

## Acceptance

1. `src/lib/storage/player-document.ts` exports `playerDocument`,
   `PlayerDocument` and `PlayerDocumentOptions`; its spec covers the cases
   above and passes.
2. `ProgressService` and `EvolutionService` subscribe to neither
   `GameAccount.players` nor `GameStorage.watch` themselves and use no
   `DeviceStorage`; their public API is unchanged.
3. `nx test feat-lazy-bacteria-game` passes, as do `lint`, `lint-templates`
   and the production build of `bacteria-game-remote`.
4. The game lib's `CLAUDE.md` says a new player-data service creates a
   `playerDocument` (replacing "listen to `players` and start over" and the
   `moveDeviceProgress` line).
5. The engine is untouched (no file under `libs/features/bacteria-engine`
   changes).

## Open questions

None.
