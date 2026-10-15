# 2. RollaPolla lists public polls and stores featured polls on first use

- Status: accepted
- Date: 2026-10-15
- Scope: `apps/rollapolla-analog`

## Context

The home page shows the hottest polls and a set of RollaPolla's own polls
("classics"), and `/polls` lists every public poll with a search. Until now a
poll was unlisted: only people with its link could find it.

## Decision

**Listing is per poll.** A poll has `listed: boolean`. The create form ticks
"Show it on the home page and in search" by default. Polls from before this
change have no `listed` field and stay unlisted, because their creators
shared them expecting only the link to lead there. The Firestore rules allow
listing a poll when `listed == true`, so the hot-polls and search queries
must filter on it.

**Search runs in the browser.** Firestore has no full-text search. `/polls`
loads the newest `PUBLIC_POLLS_LIMIT` (200) open listed polls and filters
them by every word of the search, ignoring case and accents
(`shared/poll-search.ts`). Hot polls are one query ordered by `totalVotes`.
Both drop polls that have closed but are not yet deleted by the TTL.

**Featured polls live in the code and are stored by their first vote.** They
are defined in `shared/featured-polls.ts` with fixed ids (`featured-…`).
`watchPoll` returns an `unsaved` draft for such an id until the document
exists. The first vote or chat message stores it with
`creatorUid: 'rollapolla'`, `listed: true` and a lifetime of a year.

The rules accept that document only if its question and options match
`featuredPolls()` in `firestore.rules` exactly, it has no votes, and it was
created within the last five minutes. They refuse any other poll whose id
starts with `featured-`, so nobody can occupy a featured id with their own
question. `featured-polls.spec.ts` checks that the code and the rules list the
same polls.

**Each poll has its own chat thread** in `polls/{pollId}/chatMessages`. A
message can only be written while the poll is open, and it expires with the
poll (`ttl` equals the poll's). The thread reuses the `chatMessages` index and
TTL settings.

## Consequences

- Featured polls need no seed script, no admin credentials and no deploy step,
  and they work the same against the emulators.
- To add or change a featured poll, edit both `FEATURED_POLLS` and
  `featuredPolls()` in the rules, then deploy the rules. Changing the text of
  a poll that already has a document does not change that document. Give a
  changed poll a new id.
- A featured poll restarts with zero votes a year after its first vote.
- Search covers the newest 200 open listed polls. More than that needs a
  search index (e.g. a keyword array, or an external search service).
- Listed polls are public user content with no moderation yet.
