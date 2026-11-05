# Spec #2770: show DNA points on the landing page, as on the My Colony page

## Goal

The main menu (the game's landing screen) shows the player's DNA the way
the My Colony screen does: the shared DNA counter
(`feat-lazy-bac-game-dna-counter`, `menu/dna-counter.component.ts`) with
the turning helix, the DNA left to spend and the DNA earned in all, glowing
gold while the DNA buys something.

## Non-goals

- No new way to earn or spend DNA, no change to `EvolutionService`.
- No change to the tiles' badges on My Colony and Evolution: they stay.
- No purchase animation on the main menu (strands fly only where DNA is
  spent).

## Decisions

- **Reuse `DnaCounterComponent`** as it is, rather than a second display:
  the issue asks for the same look, and one component keeps them in step.
- **Place it in the campaign card**, right under the rank standing (XP),
  left-aligned. The card already holds the player's progress, and the top
  bar (account, sound, fullscreen) sits absolutely in the corner, where a
  pill this wide would cover the title on a phone.
- **The main menu stays dumb**: it takes the numbers as inputs (`dna`,
  `dnaEarned`, `dnaLoaded`) and `bacteria-game.component.html` passes them
  from `EvolutionService` (`dna()`, `earned()`, `loaded()`), as it already
  does for the badges.
- **Glow (`ready`) while the DNA buys anything**: on the Evolution or the
  My Colony screen, i.e. while either tile carries its badge
  (`evolveDna() > 0 || colonyDna() > 0`).
- Before the storage answered, the counter says "loading" as on My Colony
  (`loaded` false).

## Acceptance

1. The main menu's card shows the DNA counter with the DNA left and the DNA
   earned in all, in English and German (the counter's existing texts).
2. The counter shows the loading text until the evolution is loaded.
3. The counter glows (`ready`) while the Evolution or the My Colony badge
   shows, and not otherwise.
4. The game passes the numbers from `EvolutionService`; the numbers match
   the My Colony screen.
5. Layout holds at phone width (portrait 360 px and landscape), no
   horizontal scroll, no overlap; component style budget not exceeded.
6. Unit specs cover 1-3; lint, template lint, format and the lib's tests
   pass.

## Open questions

None.
