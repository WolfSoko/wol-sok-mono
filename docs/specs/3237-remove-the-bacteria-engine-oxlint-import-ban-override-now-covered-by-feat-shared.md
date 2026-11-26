# Remove the bacteria-engine oxlint import-ban override now covered by feat-shared

Issue: [#3237](https://github.com/WolfSoko/wol-sok-mono/issues/3237)

## Goal

The engine (`feat-shared-bacteria-engine`) keeps out of Angular, NgRx, RxJS, Firebase, rendering and sound through one rule, the `feat-shared` tag constraint of `@nx/enforce-module-boundaries` in `.oxlintrc.json`, instead of two.

## Non-goals

- No change to the `feat-shared` constraint itself or to any other override.
- No new ban (the DOM stays unchecked by lint, as before).
- Older plans and specs that mention the override stay as written: they record history.

## Decisions

1. **Delete the override, no comment in its place.** Since [#3228](https://github.com/WolfSoko/wol-sok-mono/pull/3228) the `feat-shared` constraint bans `@angular/*` (which covers `@angular/fire`), `@ngrx/*`, `rxjs`, `rxjs/*`, `firebase` and `firebase/*` for every `feat-shared` lib, and its `onlyDependOnLibsWithTags` (`shared`, `utils`, `api`) refuses `@wolsok/feat-bacteria-rendering` and `@wolsok/feat-bacteria-sound` (both `feature:game-kit`). The override repeats both; a comment would only repeat CLAUDE.md.
2. **CLAUDE.md says where the rule lives.** The engine's description in "Cloud Functions (Bacteria Wars)" lists what the engine must not import; it gains that the `feat-shared` constraint in `.oxlintrc.json` enforces it, so nobody adds a second override again.
3. **A config test keeps the ban.** With the override gone, the constraint is the only guard. `tools/ci/feat-shared-bans.test.mjs` (`npx nx test tools`) fails when the `feat-shared` constraint stops banning one of the packages or starts allowing the rendering or sound lib's tag.

## Acceptance

- [ ] The `libs/features/bacteria-engine/src/**/*.ts` `no-restricted-imports` override is gone from `.oxlintrc.json`.
- [ ] CLAUDE.md's engine description names the `feat-shared` constraint as the guard.
- [ ] `npx nx lint feat-shared-bacteria-engine` passes; with a scratch file in the engine importing `@angular/core`, `rxjs`, `firebase/app`, `@wolsok/feat-bacteria-rendering` and `@wolsok/feat-bacteria-sound` it fails on each import (checked by hand, file removed again).
- [ ] `npx nx test tools` passes, the new test included.

## Open questions

None.
