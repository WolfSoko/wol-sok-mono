# Plan 2814: bacteria-game specs are not type-checked

Spec: [docs/specs/2814-…](../specs/2814-bacteria-game-specs-are-not-type-checked-tsc-on-tsconfig-spec-json-reports-errors.md)

1. **Fail on unused vars in the game lib.** `.oxlintrc.json`: an override
   `files: ["libs/features/lazy/bacteria-game/**/*.ts"]` with
   `"no-unused-vars": "error"`. Test first: `nx lint feat-lazy-bacteria-game`
   now fails on the four imports (red).
2. **Remove the unused imports.** `arena/arena-renderer.ts` (`lerp`, merge
   the duplicate `canvas-math` import), `bacteria-game.component.spec.ts`
   (`MatchmakerService`, `MATCH_LEVELS`, `replayOf`). `nx lint` green,
   `typecheck-specs` and `test` green.
   Commit 1+2 together: `fix(feat-lazy-bacteria-game): remove unused imports and fail lint on new ones`.
3. **Spec and plan** in `docs/specs`, `docs/plans`: commit
   `docs(feat-lazy-bacteria-game): spec and plan for #2814`.
4. Format, `nx affected -t lint,lint-templates,test,typecheck-specs`, push,
   PR with `Closes #2814`.
