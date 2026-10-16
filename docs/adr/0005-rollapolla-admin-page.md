# 5. RollaPolla has an admin page, backed by Firestore rules alone

- Status: accepted
- Date: 2026-10-16
- Scope: `apps/rollapolla-analog`

## Context

Nobody could remove spam polls or chat messages, see how much RollaPolla
is used, or switch a feature off without a deploy. The app has no backend
of its own besides SSR: everything the browser does goes straight to
Firestore and is guarded by `firestore.rules`.

## Decision

**Admins are documents.** A visitor signed in with Google is an admin when
`admins/{uid}` exists. The first admin is added in the Firebase console
(the "No access" card on `/admin` shows the uid to add); admins then grant
and revoke the rights of others on the Users tab. Nobody can revoke their
own, so one admin always remains. Custom claims would need the Admin SDK,
i.e. a Cloud Function; a document is checked by the rules with one
`exists()`.

**`/admin`** (`pages/admin.page.ts`, tabs in `core/admin/`) shows:

- _Statistics_: aggregation queries (counts, sum of votes), loaded on demand.
- _Polls_: all polls, listed or not, newest first; delete any.
- _Messages_: one collection group query over the live chat and all poll
  discussions, newest first; delete any. Legacy `notes` are read-only.
- _Users_: `users/{uid}`, which every visitor signed in with Google writes
  for themselves at most once a day (`record-visits.ts`): Firebase Auth cannot
  list users from the browser. Anonymous visitors are not recorded.
- _Features_: the toggles below.

All of it goes through `AdminPort`; the rules enforce every call.

**Feature toggles live in `appConfig/features`**, one bool per flag
(`pollCreation`, `lobbyChat`, `pollChat`), readable by everyone, writable by
admins. A missing document or flag means on. `AppConfigPort.features` is a
live signal; the server renders with the stored toggles and hands them to
the browser through `TransferState`, so hydration starts from what the
server rendered (also for the prerendered home page, which then updates
live). The rules check the flags too, so a switched-off feature is off for
old clients as well.

## Consequences

- Creating a poll and posting a message read `appConfig/features` once more
  in the rules (one more document read per write).
- Admin lists re-run their query with a larger limit while scrolling, like
  the public lists (ADR 0004).
- New flags need an entry in `FEATURES` (`src/shared/app-config.ts`) and in
  `featureFlags()` in the rules; `app-config.spec.ts` checks they match.
- One more single-field index: `chatMessages.createdAt` descending at
  collection group scope.
- Users who signed in with Google before this change show up once they
  visit again.
