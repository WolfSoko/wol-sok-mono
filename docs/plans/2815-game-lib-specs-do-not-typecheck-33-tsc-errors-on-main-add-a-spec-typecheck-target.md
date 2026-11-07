# Plan: game lib specs typecheck

Spec: [`docs/specs/2815-…`](../specs/2815-game-lib-specs-do-not-typecheck-33-tsc-errors-on-main-add-a-spec-typecheck-target.md). Branch `claude/epic-allen-5wmesl` off `main`.

1. **Add the target first (red).** `nx.json` `targetDefaults["typecheck-specs"]`; `typecheck-specs` in `libs/features/lazy/bacteria-game/project.json`. Test: `npx nx typecheck-specs feat-lazy-bacteria-game` fails with the 23 errors. Committed together with task 2, since a red target alone breaks CI.
2. **Fix the spec errors, file by file** (`arena-view.component.spec`, `shape-batch.spec`, `level-preview.service.spec`, `progress.service.spec`, `game-sound.service.spec`, `arena-stage.spec`, `stage-frame.spec`, `game-state.service.spec`, `firebase-game-account.spec`, `ad-slot.component.spec`, `winner.component.spec`, `testing/fake-game-account.ts`). Test: target green, `nx test feat-lazy-bacteria-game` same count as `main`. Commit `test(feat-lazy-bacteria-game): typecheck the specs and fix their type errors`.
3. **CI.** Add `typecheck-specs` to the `nx affected -t=` list in `.github/workflows/ci-cd.yml`. Commit `chore(github): run typecheck-specs targets in CI`.
4. **Docs.** `CLAUDE.md` Testing names the `typecheck-specs` target. Commit `docs(feat-lazy-bacteria-game): ...`; the spec and plan go in their own first commit.
5. Before each commit: `npx nx format:write`, `npx nx affected -t lint,lint-templates`.
