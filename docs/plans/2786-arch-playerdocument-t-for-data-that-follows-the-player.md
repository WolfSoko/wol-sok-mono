# Plan #2786: `playerDocument<T>()`

1. **Spec first** (`libs/features/lazy/bacteria-game/src/lib/storage/player-document.spec.ts`):
   the pipeline cases of the spec, against `FakeGameAccount` and
   `LateGameStorage`, through `TestBed.runInInjectionContext`. They fail.
2. **The document** (`storage/player-document.ts`): `playerDocument<T>()`
   with options and result as specified. Spec passes.
3. **Progress** (`progress.service.ts`): hold a document under
   `PROGRESS_STORAGE_KEY`; `onStored` earns the stored progress's
   achievements and writes them back; `store` goes through `apply`. Drop
   `switchTo`, `moveDeviceProgress`, `adopt` and the `DeviceStorage`
   injection. In `progress.service.spec.ts` delete the pipeline cases, keep
   the domain ones.
4. **Evolution** (`evolution.service.ts`): the same, with `equal:
   sameEvolution`, `onSwitch` restarting the Start timer and dropping the
   skin pick's trust, `onStored` dropping it too. `apply` and `reset` go
   through the document. Same spec cleanup.
5. **Docs**: the game lib's `CLAUDE.md` (accounts paragraph and the device
   move line).
6. **Check**: `nx test feat-lazy-bacteria-game`, `lint`, `lint-templates`,
   `format:write`, pinned oxfmt check, production build of
   `bacteria-game-remote`.
7. One commit `refactor(feat-lazy-bacteria-game): keep player data in a playerDocument`
   with spec and plan, PR to `main` with `Closes #2786`.
