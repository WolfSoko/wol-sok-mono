# Plan: `replayVerdict()`: the engine judges a replay

Spec: [`docs/specs/2781-arch-replayverdict-the-engine-judges-a-replay.md`](../specs/2781-arch-replayverdict-the-engine-judges-a-replay.md)

1. **Engine verdict, test first.**
   - Files: `libs/features/bacteria-engine/src/lib/state/replay-verdict.spec.ts`
     (new: acceptance 1-4 on `recordedReplay()` with tampered headers),
     `replay-verdict.ts` (new: `replayVerdict`, `ReplayVerdict`),
     `libs/features/bacteria-engine/src/index.ts` (export both).
   - Tests: `npx nx test feat-shared-bacteria-engine`.
   - Commit: `feat(feat-shared-bacteria-engine): judge a replay against its header with replayVerdict`.
2. **Functions on the new seam.**
   - Files: `apps/bacteria-wars-functions/src/boards/verify.spec.ts` (mock
     `replayVerdict`, drop the field-by-field mismatch cases, add the
     `unplayable` mapping), `verify.ts` (call `replayVerdict`, keep timing,
     summary and `medalOf`).
   - Tests: `npx nx test bacteria-wars-functions`.
   - Commit: `refactor(bacteria-wars-functions): verify replays through the engine's replayVerdict`.
3. **Docs.**
   - Files: `CLAUDE.md` (Cloud Functions: `verify.spec.ts` mocks
     `replayVerdict`), spec and plan.
   - Checks: `npx nx format:write`, `npx nx affected -t lint,lint-templates,test`.
   - Commit: `docs(bacteria-wars-functions): name replayVerdict as the verification seam`.
