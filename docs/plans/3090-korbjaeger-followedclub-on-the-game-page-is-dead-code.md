# Plan: Korbjäger: followedClub on the game page is dead code

Spec: [docs/specs/3090-korbjaeger-followedclub-on-the-game-page-is-dead-code.md](../specs/3090-korbjaeger-followedclub-on-the-game-page-is-dead-code.md)

## Task 1: move the open-side case to `followedSide` (test first)

- Files: `apps/korbjaeger/src/app/game-page/followed-club.spec.ts`
- Add "skips a side the Liga fills later" to the `followedSide` block; it passes against the current code (the behaviour lives in `followedSide`).
- Test: `nx test korbjaeger -- followed-club`.

## Task 2: remove `followedClub` and rename the file

- Files: `game-page/followed-club.ts` → `game-page/followed-side.ts`, `followed-club.spec.ts` → `followed-side.spec.ts`, imports in `game-page.component.ts` and `game-report-part.ts`.
- Delete `followedClub` and its `describe` block; drop the unused `ClubId` import.
- Tests: `nx test korbjaeger`, `nx lint korbjaeger`, `nx lint-templates korbjaeger`.

## Task 3: CLAUDE.md

- Files: `CLAUDE.md` (the Spiel page's colours: `followedClub` → `followedSide`).

## Commit

One commit `refactor(korbjaeger): remove the dead followedClub (#3090)` with spec, plan and tasks 1–3, after `nx format:write`.
