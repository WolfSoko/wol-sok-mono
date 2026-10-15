# 4. RollaPolla lists load page by page as you scroll

- Status: accepted
- Date: 2026-10-15
- Scope: `apps/rollapolla-analog`
- Supersedes: the fixed limits of [ADR 0002](0002-rollapolla-public-and-featured-polls.md)

## Context

`/polls` loaded the newest 200 open listed polls and sorted and searched
them in the browser; "My polls" showed the newest 50. Older polls were
unreachable, and "Hot" only ranked the newest 200.

## Decision

**Endless scroll over a growing live query.** Each list asks Firestore for
its first 20 polls (one more, to know whether there are more). When the end
of the list comes near the viewport (`rap-endless-scroll-end`, an
`IntersectionObserver` 600px ahead), the same query runs again for 20 more
(`EndlessScroll`, `core/endless-scroll/`). The list stays live: votes, edits
and new polls show up as before. The previous answer stays on screen until
the next one arrives.

**Firestore sorts.** "Hot" orders by `totalVotes desc, createdAt desc`, "New"
by `createdAt desc`, both on `listed == true` (new composite index
`listed, totalVotes desc, createdAt desc`). Changing the order starts again
at the first page. Polls that closed but are not yet deleted by the TTL are
dropped after loading; the page may show fewer than asked for, and the end
of the list, still in view, loads the next page.

**Search still runs in the browser**, over the polls loaded so far. While
few of them match, the end of the list stays in view and further pages
load, until the matches fill the screen or every listed poll is loaded.

The home page's hot polls stay a short fixed list.

## Consequences

- Every poll is reachable, in either order.
- Each step re-runs the query with a larger limit, so the polls already
  shown are read again (from the local cache where possible). Scrolling
  through n polls costs about n²/40 document reads instead of n. Fine at
  RollaPolla's size; cursor-based pages (`startAfter`) would cut this but
  make live reordering (votes change the "Hot" order) much harder.
- A search that matches little can load every listed poll. A real search
  index would avoid that once there are many polls.
- The home page's hot list asks for 10 polls more than it shows. Only if
  more than 10 closed polls with more votes still wait for the TTL can it
  show fewer.
- One more composite index to deploy.
