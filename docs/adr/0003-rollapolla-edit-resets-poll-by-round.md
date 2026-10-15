# 3. RollaPolla resets an edited poll by starting a new voting round

- Status: accepted
- Date: 2026-10-15
- Scope: `apps/rollapolla-analog`

## Context

Creators may edit and delete their own polls. Editing changes the question
or the answers, so the votes cast so far no longer fit and the poll starts
over: every count drops to zero and everybody may vote again.

Each vote is a document `polls/{pollId}/votes/{uid}`; the rules allow one per
user and poll. Resetting the poll by deleting those documents is not
possible from the browser: the creator can neither list nor delete other
people's votes, and a poll can have more votes than one batch can hold.

## Decision

**A poll has a `round`, and only votes from the current round count.** The
poll starts in round 0 (stored polls have no `round` field until their first
edit). An edit is one update that replaces question, answers and listing,
sets all counts to zero and raises `round` by exactly one; the rules check
that, and that creation time, TTL and creator stay. A vote records the round
it was cast in. A user may vote when they have no vote yet or their vote is
from an earlier round; the new vote replaces the old document.

The app shows a vote as the visitor's own only when its round matches the
poll's. The vote hint kept in the browser is keyed by poll and round
(`id` for round 0, so hints from before stay valid, `id#round` after).

**Deleting removes only the poll document.** Its votes and chat messages
cannot be deleted by the creator either; they expire with the poll's TTL,
and nothing shows them in the meantime.

Edits and deletions apply locally at once, like creating and voting. If the
backend refuses one, the previous state comes back and a snackbar says so.

Only open polls can be edited (a closed poll takes no votes, so there is
nothing to reset); any own poll can be deleted. Featured polls belong to
RollaPolla (`creatorUid: 'rollapolla'`) and can be neither.

## Consequences

- No server code and no fan-out write: an edit costs one document write.
- Votes from earlier rounds stay in Firestore until the TTL removes them.
- The poll's chat thread survives an edit. Messages written about the old
  question stay visible.
- Editing does not extend the poll's lifetime; it still closes 30 days after
  it was created.
