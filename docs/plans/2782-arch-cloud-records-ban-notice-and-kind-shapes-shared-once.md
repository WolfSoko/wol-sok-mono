# Plan: cloud records shared once

Spec: [`docs/specs/2782-arch-cloud-records-ban-notice-and-kind-shapes-shared-once.md`](../specs/2782-arch-cloud-records-ban-notice-and-kind-shapes-shared-once.md).

1. **Engine module, test first.** `libs/features/bacteria-engine/src/lib/state/cloud-records/`:
   `ban.ts` (`CloudBan`, `parseBan`, `banHolds`, `mirroredBan`, `parseMirroredBan`),
   `notices.ts`, `replays.ts`, `boards.ts` (hide reasons), `admin-stats.ts`, with `ban.spec.ts`
   for the edge cases. Export from `src/index.ts`.
   Check: `nx test feat-shared-bacteria-engine` (incl. `engine-bundle.spec.ts`).
2. **Functions.** `admin/bans.ts` (`banOf`, `holds`, `holdsInRealtime`, the mirror's value),
   `limits.ts` (`isBanned`), `admin/records.ts` (`NoticeType`), `replays/accept-plan.ts`
   (`ReplayKind`), `boards/entries.ts` (`HiddenBy`), `admin/stats.ts` (`AdminStats`).
   Specs: `limits.spec.ts` keeps the cache and its Timestamp mapping only.
   Check: `nx test bacteria-wars-functions`, `nx run bacteria-wars-functions:build`.
3. **Game.** `storage/game-moderation.ts` (`parseBan`, `parseMirroredBan`, `banHolds`,
   `NOTICE_TYPES`), `storage/replay-records.ts` and `storage/firestore-game-replays.ts`
   (`ReplayKind`, `ReplayState`, their lists); `admin-kit.ts` re-exports what the admin needs.
   Spec: `game-moderation.spec.ts` keeps its Timestamp mapping and the stream tests.
   Check: `nx test feat-lazy-bacteria-game`.
4. **Admin.** `moderation/admin-records.ts` (`parseBan`, `banHolds`, `HIDE_REASONS`),
   `overview/admin-stats.ts` (`AdminStats` from the engine plus `at`, the figures from the list).
   Spec: `admin-records.spec.ts` keeps its mapping only.
   Check: `nx test feat-lazy-bacteria-wars-admin`.
5. **Docs.** `CLAUDE.md` (Cloud Functions section) names `state/cloud-records/`; the deepening
   document marks candidate 6 done if it tracks that.
   Check: `nx format:write`, `nx affected -t lint,lint-templates,test`.

One commit per task, `refactor(<project>): ...`, one PR.
