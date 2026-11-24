# Spec: keep the UI hidden while the player profile loads ([#3241](https://github.com/WolfSoko/wol-sok-mono/issues/3241))

## Goal

When the game opens (or a player switch happens on sign-in or sign-out),
the menu screens render at once with defaults: rank 1, 0 XP, level 1 open,
no medals, the default colony colours and language, no account chip, the
Google photo before the stored avatar, a small bacterium. When storage and
Firestore answer, all of it changes in place and the layout jumps. The menu
screens stay hidden behind the stage's bacteria spinner until the player
profile is known. Then they appear in their final state.

## Non-goals

- No skeletons per element. One gate for the whole screen area.
- No change to how any of the sources load or to their own `loaded` flags.
- The match screens (pause, result) and the arena are not gated. A match
  never waits on storage (`EvolutionService.settled` stays as it is).

## Decisions

1. **"The player profile is known"** is the conjunction of the flags that
   already exist:
   - `SettingsService.loaded`: colours, language and sound.
   - `ProgressService.loaded`: XP, rank, campaign, medals and achievements.
   - `EvolutionService.loaded`: DNA and skins.
   - With the cloud (`GameAccount.cloud`), also `GameAccount.profile() !== null`
     (the account chip) and, when `SocialService.available`,
     `SocialService.profileLoaded` (the stored avatar and name).
   
   The rule is a pure function, `profileKnown(...)`, so it is tested
   without Angular.
2. **It never hides forever.** A root service `ProfileGate`
   (`menu/profile-gate.ts`) exposes `ready = known || waitedOut`.
   `waitedOut` turns true `PROFILE_WAIT_MS` (3 s, as `EVOLUTION_WAIT_MS`)
   after the player became known. The wait restarts on every switch of
   `GameAccount.players`, so a failed Firestore read (`profileLoaded` stays
   false) or an offline start shows the menu after 3 s with what is there.
   This follows the pattern of `EvolutionService.waitForStorage`.
3. **The screens panel hides, it is not removed.** While `!ready`, the
   content of `.stage-panel.screens` (social notices and the open screen)
   gets `visibility: hidden` and `inert`, so it lays out and the bacterium
   menu's `@defer` chunk still loads. The bacteria spinner
   (`feat-lazy-bac-game-bacteria-spinner`, label "Loading profile…" /
   „Profil wird geladen…") sits centred in its place. The swarm behind it
   stays visible. When the gate opens, the content fades in (150 ms, none
   with reduced motion), so the change is a single appearance and not a jump.
4. **The splash waits too.** On the game's own site, `index.html` shows a
   splash that `ngAfterViewInit` takes away. It is taken away once the gate
   opens, so a visitor sees the splash and then the finished menu, not the
   splash, then a spinner, then the menu. In the shell there is no splash,
   and the spinner covers the wait.

## Acceptance

1. `profileKnown` is true only when every flag that applies is true. Without
   the cloud, account and social are ignored. With the cloud but no social,
   social is ignored (spec).
2. `ProfileGate.ready` is false at start, true once the profile is known, or
   true after `PROFILE_WAIT_MS` without it. A player switch closes it again
   and restarts the wait (spec, fake timers).
3. While the gate is closed, the screens panel's content is hidden and inert
   and the spinner shows. Once open, the content is visible and the spinner
   is gone (component spec).
4. The splash is dismissed only once the gate opens (component spec).
5. Lint, lint-templates, test and typecheck-specs of `feat-lazy-bacteria-game`
   pass, the production build of `bacteria-game-remote` keeps its budgets,
   and its e2e (which starts on the main menu) still passes.
6. A Playwright check of the running game (served locally): the first frame
   that shows the menu already shows it in its final layout.

## Open questions

None.
