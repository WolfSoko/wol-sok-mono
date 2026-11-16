# Bacteria Wars: loading spinner not centered

Issue: [#3104](https://github.com/WolfSoko/wol-sok-mono/issues/3104)

## Goal

The stage's busy indicator (`StageBusyComponent`, `busy/stage-busy.component.ts`), shown while a
tap's heavy work runs (a mode or level picked, a match started), is seen whole and centred on the
stage, and is replaced by a spinner of the game's own: bacteria that chase and eat each other round
a circle.

## Why it is cut off today

The `mat-progress-spinner` host gets `width`/`height` 56px inline from Material, and the component
adds `padding: 0.875rem` and a border to that same host for its round backdrop. The app's global
`box-sizing: border-box` (`apps/bacteria-game-remote/src/styles.scss`, the shell's too) shrinks the
content box to about 26px, while the 56px SVG inside keeps its size and overflows to the right and
down: the ring is cut and sits off the backdrop's centre.

## Non-goals

- The splash screen in `apps/bacteria-game-remote/src/index.html` (shown before the game's code
  loads) stays as it is.
- The small `mat-spinner`s of the online lobby and the pads' progress rings stay Material.
- No change to `StageBusy` (when the indicator shows, the delay, the dropped second tap).

## Decisions

1. **A CSS-animated inline SVG, not the simulation's shaders.** The indicator is up exactly while
   the main thread is blocked (`StageBusy.run` paints it, then runs the work). Anything drawn per
   frame from JavaScript (WebGL shaders, a canvas like `ColonyPreviewComponent`) freezes for that
   time, and creating a WebGL context costs more main-thread time on the slow phones it is for.
   Only `transform` and `opacity` animations run on the compositor and keep moving, so the spinner
   animates those alone. It takes the shaders' look instead: the arena's colony colours.
2. **The picture:** six bacteria on a ring, alternating the player's colour (`--bw-player`) and the
   opponent's (`--bw-opponent`). The ring turns; each bacterium swells while it closes in on the one
   ahead and shrinks back as the next one swells, a wave running round the ring, so each one seems
   to swallow the next. Each cell has a body and a lighter nucleus, as in the arena.
3. **Its own component** `feat-lazy-bac-game-bacteria-spinner` (`busy/bacteria-spinner.component.ts`),
   presentational and size-driven by a `--spinner-size` custom property (default 4rem), so the busy
   veil only places it. The backdrop disc is the spinner's own element, sized with the SVG, so
   nothing can overflow it again.
4. **Accessibility:** the spinner is `role="progressbar"` (indeterminate, as Material's) with the
   existing `stage.busy` label. With `prefers-reduced-motion: reduce` the bacteria stand still in
   their ring and only the ring's opacity breathes slowly.
5. The game passes the opponent's colour to the indicator as it does the player's
   (`hud.colonyCss()[1]`), with fallbacks for both, so the menu (no match yet) shows the defaults.

## Acceptance

1. With the indicator up, the spinner and its backdrop are fully visible and centred on the stage
   (centre of the spinner within 1px of the stage's centre; the SVG's box inside the backdrop's box),
   embedded and fullscreen, on a phone-sized and a desktop viewport.
2. It shows six bacteria in alternating player and opponent colours, turning and swelling in turn.
3. Its animations use only `transform` and `opacity`.
4. It has `role="progressbar"` and the translated `stage.busy` label.
5. Reduced motion: no turning or swelling.
6. `StageBusy`'s behaviour and specs are unchanged; lint, template lint and the lib's tests pass; the
   game's component style budget holds.

## Open questions

None.
