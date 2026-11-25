# Spec: rollapolla sitemap lists every public poll, including newly created ones

Issue: [#3246](https://github.com/WolfSoko/wol-sok-mono/issues/3246)

## Finding

The sitemap is already dynamic. `/sitemap.xml` is the Nitro route
`apps/rollapolla-analog/src/server/routes/sitemap.xml.ts`, run on every
request that misses Firebase Hosting's CDN (cached one hour):

- `listedPolls()` (`src/server/sitemap/listed-polls.ts`) reads the newest 1000
  polls with `listed == true`, ordered by `createdAt`, anonymously through
  `firebase/firestore/lite` (the rules let anyone list listed polls; the
  composite index `listed` + `createdAt` exists).
- `sitemapUrls()` (`src/server/sitemap/sitemap.ts`) adds every listed poll
  still open to the static pages and the featured polls.
- When Firestore fails or answers after 5 s, the route serves the static pages,
  cached one minute.

Verified on 2026-11-24 in production: the user poll created on 2026-11-02 and
listed on `/polls` is in `https://rollapolla.com/sitemap.xml`. A new public
poll therefore appears within an hour, with no manual step.

## Goal

Keep that behaviour covered by tests. `sitemapUrls()` and `sitemapXml()` have
specs; the parts that make the sitemap dynamic do not:

- `listedPolls()`: the Firestore query and the mapping of its documents.
- The route: polls from Firestore end up in the answer with the one-hour cache,
  and a failed read still answers with the static pages and the short cache.

## Non-goals

- No change to what the sitemap lists or how long it is cached.
- No emulator e2e: the app's e2e runs with Firestore offline.
- No `lastmod`, sitemap index or ping to search engines.

## Decisions

- Unit specs with `vi.mock` of `firebase/firestore/lite` and `firebase/app`
  (as `google-analytics.spec.ts` mocks `firebase/analytics`): fast and
  deterministic, and they pin the query (`listed == true`, `createdAt` desc,
  limit) that the rules and the index depend on.
- The route spec mocks `listedPolls` and calls the h3 handler with a minimal
  event, so the route's two cache paths are pinned without Firestore.

## Acceptance

1. A spec shows `listedPolls()` queries `polls` with `listed == true`, ordered
   by `createdAt` descending, limited, and maps each document to its id and
   `ttl` as `closesAt`.
2. A spec shows a document without `ttl` is skipped, the others still listed.
3. A spec shows a Firestore read that does not answer in time is rejected.
4. A spec shows the route lists a newly listed open poll with
   `max-age=3600`, and on a failed read answers the static pages with
   `max-age=60`.
5. `nx test rollapolla-analog`, lint and `typecheck-specs` pass.

## Open questions

None.
