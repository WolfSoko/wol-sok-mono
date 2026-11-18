# Bacteria Wars: the game's sound in a lib of its own

Issue: [#3102](https://github.com/WolfSoko/wol-sok-mono/issues/3102) step 5, tracked in [#2370](https://github.com/WolfSoko/wol-sok-mono/issues/2370). Follows [PR #3117](https://github.com/WolfSoko/wol-sok-mono/pull/3117), which moved the GPU simulation and the arena rendering into `feat-bacteria-rendering` ([spec](3102-arch-give-the-game-s-gpu-simulation-and-arena-rendering-a-lib-of-their-own.md)).

## Goal

`libs/features/lazy/bacteria-game/src/lib/sound/` (about 2.5k lines of source, 0.7k of specs: the Web Audio synth, the level and menu music, the step scheduler) imports only the engine, `@angular/core` and one game file, `../settings.service` (`GameSettingsService`, `MAX_VOLUME`). Move it into a project of its own, so that:

- a change to the game's menus, state or network no longer reruns the sound specs, and a change to the sound no longer reruns the game's 170 spec files;
- the game reaches the sound only through the new lib's `src/index.ts`;
- the sound reads the player's sound settings through a narrow port, not the game's whole settings service.

No behaviour changes: the same sound plays at the same levels.

## Non-goals

- Reworking the synth, the music or what an effect sounds like.
- Moving the sound settings (`settings/setting-table.ts`) or their UI: they stay the game's.
- Any other folder of the game lib.

## Decisions

1. **Name, place, tag.** `libs/features/bacteria-sound`, project `feat-bacteria-sound`, alias `@wolsok/feat-bacteria-sound`, tag `feature:game-kit`, as `feat-bacteria-rendering`: it depends on the engine (`feat-shared`), which a `feat-shared` lib may not, and `feature:lazy` may already use `feature:game-kit`. No `-shared-` in the name, since the tag is not `feat-shared` (handover of step 4). Its `bannedExternalImports` (Firebase, `@angular/fire`, NgRx) come with the tag. It has no components, so no selector prefix goes into `eslint.config.mjs`.
2. **A port for the settings: `SoundSettings`.** The lib defines `interface SoundSettings { sound(): boolean; music(): boolean; musicVolume(): number; effects(): boolean; effectsVolume(): number }`, the volumes as fractions from 0 to 1, each read like a signal. That is exactly what the service reads today (five `settings.value(...)` calls and the division by `MAX_VOLUME`); the division moves to the game's adapter, so `MAX_VOLUME` stays the game's.
3. **How the port is wired: the game keeps `GameSoundService` as a two-line root service over the lib's class.** The lib's class `GameSound` (today's `GameSoundService` body, renamed, no `@Injectable`) takes the `SoundSettings` in its constructor and must be built in an injection context (it creates an `effect`). The game's `sound/game-sound.service.ts` becomes `@Injectable({ providedIn: 'root' }) class GameSoundService extends GameSound`, whose constructor passes `soundSettingsOf(inject(GameSettingsService))`.
   - Why not an injection token the game provides: `GameSoundService` is a root singleton (one `AudioContext`, document listeners added once), and the game has no root providers of its own: it is loaded as a lazy route by the remote and by the shell. A token provided on the route could not be seen by a root service; making the service route- or component-provided would touch eleven specs' providers and, at component level, create a second `AudioContext` per visit.
   - The game's ten importers keep `inject(GameSoundService)` from the same file; only `levelMusic` and the type `Soundtrack` (`bacteria-game.component.ts`, `flow/play-flow.ts`) come from `@wolsok/feat-bacteria-sound`.
4. **Folder layout:** the lib's `src/lib/` holds today's `sound/` files flat (`game-sound.ts`, `level-music.ts`, `music-player.ts`, `menu-music.ts`, `menu-music-player.ts`, `step-scheduler.ts`, `audio-nodes.ts`, `sound-settings.ts`), with their specs. Relative imports between them stay.
5. **Public API.** `src/index.ts` exports by name: `GameSound`, `type SoundSettings`, `type Soundtrack`, `levelMusic`, `EVOLVE_LAND_SEC` and the `type LevelMusic`, as far as the game uses them; nothing else.
6. **Specs.** `game-sound.service.spec.ts` moves to the lib as `game-sound.spec.ts` and drives a fake `SoundSettings` of signals instead of `GameSettingsService`. The game keeps one small spec for the adapter: `soundSettingsOf` maps each switch and divides each volume by `MAX_VOLUME`, and `GameSoundService` follows a setting changed through `GameSettingsService`.
7. **Project setup** copies `feat-bacteria-rendering`'s: buildable (`@nx/angular:ng-packagr-lite`, since the game lib is buildable), Jest with the zoneless `jest-preset-angular` setup, `typecheck-specs`, the same `tsconfig.*`, a `package.json` with its peer dependency on `@angular/core`, MIT, a short `README.md`.
8. **Federation.** `@wolsok/feat-bacteria-sound` is skipped in `tools/federation/workspace-federation.js` beside the game lib, the engine and the rendering lib.
9. **Docs.** CLAUDE.md's "Native Federation" skip list names the new lib; the game lib's `README.md`/`CLAUDE.md` point to it for sound; `docs/architecture/README.md` is regenerated (`npm run arch:diagrams`).

## Acceptance

1. The sound's sources and specs live in `libs/features/bacteria-sound`, which imports nothing from `feat-lazy-bacteria-game` (lint with the boundary rule green; `nx graph`: no edge to the game).
2. Nothing outside the new lib imports a path inside it: grep for `bacteria-sound/src` and for `sound/(level-music|music-player|menu-music|step-scheduler|audio-nodes)` in the game finds nothing.
3. A change only to `libs/features/lazy/bacteria-game/src/lib/menu/**` does not make `feat-bacteria-sound` affected (`nx show projects --affected --files=<a menu file>`).
4. `nx run-many -t test,typecheck-specs,lint,lint-templates,build` is green for the new lib, the game lib, the admin lib and `bacteria-game-remote`; the moved specs run in the new project and the game's adapter spec passes.
5. `bacteria-game-remote`'s production build stays within its budgets and `check-lazy-admin.mjs` passes; `angular-examples` builds.
6. The game runs standalone (`bacteria-game-remote` e2e smoke).
7. `docs/architecture/README.md` shows the new project with no cycle and no tag violation.

## Open questions

- None blocking. With this step every step of #3102 is done, so the PR closes the issue (`Closes #3102`).
