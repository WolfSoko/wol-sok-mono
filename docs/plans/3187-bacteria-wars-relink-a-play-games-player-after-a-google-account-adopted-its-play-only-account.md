# Plan: relink a Play Games player after a Google account adopted its Play-only account ([#3187](https://github.com/WolfSoko/wol-sok-mono/issues/3187))

Spec: `docs/specs/3187-bacteria-wars-relink-a-play-games-player-after-a-google-account-adopted-its-play-only-account.md`

1. **Engine contract** (`libs/features/bacteria-engine/src/lib/state/cloud/play-games-sign-in.ts` + spec):
   failing spec for `parsePlayGamesAdoption` first; add `PLAY_GAMES_RELEASES`,
   `PLAY_GAMES_ADOPTIONS`, `ADOPTION_WINDOW_MS`, `PlayGamesAdoptionError`,
   `parsePlayGamesAdoption`; export through `/cloud`.
2. **Rules, TTL, erasure** (`apps/bacteria-game-remote/firestore.rules`,
   `firestore.indexes.json`, `rules-test`, `apps/bacteria-wars-functions/src/erasure/player-data.ts`):
   failing rules tests first (acceptance 5), then the two `match` blocks, the
   TTL overrides and the table entries.
3. **Trigger** (`apps/bacteria-wars-functions/src/play-games/adoption.ts`,
   `adoption.emulator.ts`, `main.ts`): failing emulator specs first
   (acceptance 2-4, 6), then `adoptPlayGamesLinks` and `runPlayGamesAdoption`,
   sharing the claim update with `sign-in.ts` (extracted, not copied); export
   behind `PLAY_GAMES_ON`.
4. **Client** (`libs/features/lazy/bacteria-game/src/lib/storage/firebase-game-account.ts`,
   a new `play-games-adoption.ts`, `game-account.ts`, `player-document.ts`,
   specs): failing specs (acceptance 1) first; the Play-only session releases
   itself with a nonce before `signInWithCredential`, the switch carries an
   `adoption` receipt (the nonce as the adoption id, an empty value too),
   and the account writes the adoption only once every document's landing
   resolved true.
5. **Privacy and docs**: section 6 (en/de) and its spec, root and lib
   `CLAUDE.md`, the spec of #3175.
6. Checks: `nx affected -t test,lint,lint-templates,typecheck-specs`,
   `bacteria-wars-functions:test-emulator`, `bacteria-game-remote:test-emulator`,
   `nx format:write`. One commit per step,
   `feat(<project>): ...`, then one PR `Closes #3187`.
