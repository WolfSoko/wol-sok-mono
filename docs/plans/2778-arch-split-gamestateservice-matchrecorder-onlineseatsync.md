# Plan #2778: split `GameStateService`

Spec: `docs/specs/2778-arch-split-gamestateservice-matchrecorder-onlineseatsync.md`.
Paths in `libs/features/lazy/bacteria-game/src/lib/`. Each task runs
`npx nx test feat-lazy-bacteria-game`, `npx nx lint feat-lazy-bacteria-game`
and `npx nx format:write` before its commit.

1. **`MatchRecorder`, test first.** `state/match-recorder.spec.ts` against a
   stub `MatchTape` and `FakeGameReplays`: not recorded, local, online
   without ref, ranked on `gpu-int` and on `cpu`, `saveMatches` off,
   online always submitted, id written back only to the current
   recording, score from samples. Then `state/match-recorder.ts`.
   Commit: `refactor(feat-lazy-bacteria-game): add MatchRecorder`.
2. **Wire the recorder.** `GameStateService` calls `begin`/`finish`/`replay`;
   delete the moved fields and methods; `replay-screen.component.ts` and
   `replay-note.component.ts` inject `MatchRecorder`; settings write prefs
   through `syncReplayPrefs()`. Move the recording describes out of
   `game-state.service.spec.ts`, keep one wiring test. Commit:
   `refactor(feat-lazy-bacteria-game): record matches through MatchRecorder`.
3. **`OnlineSeatSync`, test first.** `net/online-seat-sync.spec.ts` with a
   fake `OnlineMatchService`: connect as host and guest, guest colours to
   host pair, setup from host, ended, host and guest match start, leave,
   setup change shares or offers. Then `net/online-seat-sync.ts`.
   Commit: `refactor(feat-lazy-bacteria-game): add OnlineSeatSync`.
4. **Wire the seat sync.** `GameStateService` applies `changes$`; delete
   `onOnline`, `shareSetup`, `onlineMatch`, `guestColors`; move the online
   seat cases of the service spec. Commit:
   `refactor(feat-lazy-bacteria-game): sync the online seat through OnlineSeatSync`.
5. **`startMatch(arena)`.** Spec in the service spec, `play-flow.ts` uses it,
   `init` private, `start` private if unused. Commit:
   `refactor(feat-lazy-bacteria-game): start a match with one call`.
6. **Docs.** Lib `CLAUDE.md` (analytics and recording paragraphs) and
   `architecture-deepening.md` status line. Commit:
   `docs(feat-lazy-bacteria-game): name MatchRecorder and OnlineSeatSync`.
7. **Check.** `npx nx affected -t test,lint,lint-templates,build`, the
   pinned oxfmt check, production build of `bacteria-game-remote` played in
   Playwright (local match, replay screen).
