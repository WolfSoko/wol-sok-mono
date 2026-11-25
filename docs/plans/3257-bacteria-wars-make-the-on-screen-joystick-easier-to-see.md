# Plan: make the on-screen joystick easier to see ([#3257](https://github.com/WolfSoko/wol-sok-mono/issues/3257))

Spec: [`docs/specs/3257-…`](../specs/3257-bacteria-wars-make-the-on-screen-joystick-easier-to-see.md).
Branch `3257-joystick-visibility` off `main`, one PR. Paths are under
`libs/features/lazy/bacteria-game/src/lib/`.

1. **Screenshots before.** Serve `bacteria-game-remote`, start a training
   match with Playwright on a touch phone viewport (portrait and landscape)
   and a large touch viewport, and take screenshots of the resting stick and
   a held one (a pointer down and dragged in the zone), on the floor and over
   the own colony. They show what the spec found.
2. **The look** (`joystick/joystick.component.scss`).
   - Custom properties for the opacities and the edge colours on `:host`.
   - Ring: 3px border in the player colour, dark outline outside, light line
     inside (`box-shadow`); fill `rgb(0 0 0 / 20%)`.
   - Knob: player colour, light 2px border, dark outline.
   - Rest: opacity 0.7; label opacity 0.85 with a dark text shadow.
   - Tests: the behaviour is unchanged, so `joystick.component.spec.ts` stays
     as it is and must pass; a look has no unit test, the screenshots check it.
   - Commit: `feat(feat-lazy-bacteria-game): make the on-screen joystick easier to see (#3257)`.
3. **Checks and PR.** `npx nx format:write`, then
   `npx nx affected --base=origin/main -t lint,lint-templates,test,typecheck-specs`,
   and `bacteria-game-remote:build:production` for `anyComponentStyle`. The
   same screenshots after, side by side with the ones before, in the PR. Open
   the PR with `Closes #3257` and the acceptance list.
