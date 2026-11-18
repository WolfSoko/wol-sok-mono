# feat-bacteria-sound

The sound of Bacteria Wars, split out of `feat-lazy-bacteria-game` (#3102):
the effects, synthesised with the Web Audio API (`GameSound`), each level's
music composed on the fly (`level-music.ts`, `MusicPlayer`), the menu's
ambient piece (`menu-music.ts`, `MenuMusicPlayer`) and the step scheduler
they play on.

It depends only on `@wolsok/feat-shared-bacteria-engine` and Angular (tag
`feature:game-kit`), and the game takes it only through
`@wolsok/feat-bacteria-sound` (`src/index.ts`). The player's sound settings
come in through the port `SoundSettings`; the game's root `GameSoundService`
(`sound/game-sound.service.ts` in the game lib) builds `GameSound` over its
device settings.

What it sounds like has no CI coverage: listen on a device after a change.
