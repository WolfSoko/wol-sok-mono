# Plan #2828: Stored replay documents still copy the playback rule

Spec: [docs/specs/2828-…](../specs/2828-stored-replay-documents-still-copy-the-playback-rule-gallery-my-matches-endless-replay-links.md).
One PR, one commit per task, test first in each.

1. **`playbackRefusal` on header fields** (`feat-shared-bacteria-engine`)
   - Files: `state/replay.ts` (`PlaybackHeader`, signature), `state/replay-verdict.ts`,
     `src/index.ts` (export the type), `state/replay.spec.ts` (call with `.header`).
   - Test: existing refusal table, now on headers.
   - Commit: `refactor(feat-shared-bacteria-engine): let playbackRefusal take the header fields it reads`
2. **`storedPlaybackRefusal`** (`feat-shared-bacteria-engine`)
   - Files: `state/cloud-records/replay-playback.ts` + spec, `src/index.ts`.
   - Test: acceptance 2, table-driven against `playbackRefusal`.
   - Commit: `feat(feat-shared-bacteria-engine): one playback check for stored replay records`
3. **Store `ladder` on accept** (`bacteria-wars-functions`)
   - Files: `replays/accept-plan.ts` (`ReplayRecord.ladder?`), `accept-plan.spec.ts`.
   - Test: acceptance 3.
   - Commit: `feat(bacteria-wars-functions): store the ladder version on replay documents`
4. **Gallery asks the engine** (`bacteria-wars-functions`)
   - Files: `gallery/candidates.ts`, `gallery/candidates.spec.ts`.
   - Test: acceptance 4.
   - Commit: `fix(bacteria-wars-functions): let the gallery take only replays its viewer plays`
5. **"My matches" asks the engine** (`feat-lazy-bacteria-game`)
   - Files: `storage/replay-records.ts` (`ReplayListing`), `storage/firestore-game-replays.ts`,
     `storage/local-game-replays.ts`, `testing/fake-game-replays.ts`,
     `replays/my-matches.component.ts`, and their specs.
   - Test: acceptance 5 and 6; `typecheck-specs`.
   - Commit: `fix(feat-lazy-bacteria-game): show a stored match as unplayable by the whole playback rule`
6. **Checks**: `nx format:write` (with the pinned oxfmt), affected
   `test,lint,lint-templates,typecheck-specs`, `test-emulator bacteria-wars-functions`.
