# Plan: Bacteria Wars loading spinner (#3104)

Spec: [docs/specs/3104-bacteria-wars-loading-spinner-not-centered.md](../specs/3104-bacteria-wars-loading-spinner-not-centered.md)

1. **Spinner component, test first.** `busy/bacteria-spinner.component.spec.ts`: renders six
   bacteria alternating player and opponent, `role="progressbar"` with its label input.
   Then `busy/bacteria-spinner.component.ts` (HTML elements, CSS keyframes on `transform` and
   `opacity` only, reduced-motion rule, `--spinner-size`).
   Commit: `feat(feat-lazy-bacteria-game): bacteria spinner for the busy stage`.
2. **Busy veil uses it.** `busy/stage-busy.component.ts`: replace `mat-progress-spinner` and its
   padded host styles with the spinner; a spec that the label reaches it. `bacteria-game.component.html`
   passes `--bw-opponent` too.
   Commit: `fix(feat-lazy-bacteria-game): show the busy spinner whole and centred`.
3. **Check in the browser.** Serve the remote, show the indicator in a phone and a desktop viewport
   (embedded and fullscreen), measure the centre and the boxes, screenshot for the PR. Lint,
   `lint-templates`, `test`, and the remote's production build (budgets).
