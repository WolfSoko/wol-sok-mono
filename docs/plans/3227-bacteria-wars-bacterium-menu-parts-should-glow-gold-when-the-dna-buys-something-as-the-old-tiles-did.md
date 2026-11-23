# Plan: bacterium parts glow gold while the DNA buys something ([#3227](https://github.com/WolfSoko/wol-sok-mono/issues/3227))

Spec: [`docs/specs/3227-…`](../specs/3227-bacteria-wars-bacterium-menu-parts-should-glow-gold-when-the-dna-buys-something-as-the-old-tiles-did.md).
Branch `3227-bacterium-ready-glow` off `main`, one PR. Paths below are under
`libs/features/lazy/bacteria-game/src/lib/menu/`.

1. **Ready flag in the model** (test first).
   - `bacterium/bacterium-model.spec.ts`: colony and evolution are `ready`
     only with DNA to spend; friends with requests and every other part
     are not.
   - `bacterium/bacterium-items.ts`: `ready` on `BacteriumItem`, set by
     `item()` for a DNA badge with a count above 0.
2. **Ready lobes in the scene and the renderer** (test first).
   - `bacterium-menu.component.spec.ts`: the scene marks the ready lobes;
     a change of readiness redraws a still cell; the parts and CSS lobes
     carry the class `ready`.
   - `bacterium/bacterium-renderer.spec.ts` (new): `packLobes` writes x, y,
     r and the ready flag, zeroes the rest, caps at `MAX_LOBES`.
   - `bacterium/bacterium-renderer.ts`: `BacteriumLobe` (anchor plus
     `ready`) in `BacteriumScene.lobes`, exported `packLobes`, used by
     `draw`.
   - `bacterium/bacterium-shader.ts`: a gold light on lobes whose `w` is 1,
     pulsing with `uTime`.
   - `bacterium-menu.component.ts/.html/.scss`: scene lobes with `ready`,
     the `ready` class on part and CSS lobe, the gold pulse and its reduced
     motion variant.
   - Commit: `feat(feat-lazy-bacteria-game): bacterium parts glow gold while the DNA buys something (#3227)`.
3. **Checks, PR.** `npx nx format:write`;
   `npx nx affected --base=origin/main -t lint,lint-templates,test,typecheck-specs`;
   `bacteria-game-remote:build:production` for budgets; Playwright
   screenshot of the main menu with DNA to spend. PR with `Closes #3227`
   and the acceptance list.
