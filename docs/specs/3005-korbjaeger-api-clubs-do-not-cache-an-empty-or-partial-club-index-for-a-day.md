# Spec #3005: Korbjäger /api/clubs: do not cache an empty or partial club index for a day

Issue: [#3005](https://github.com/WolfSoko/wol-sok-mono/issues/3005), together
with [#3004](https://github.com/WolfSoko/wol-sok-mono/issues/3004) (same
privacy text, as #3005 asks). Follows
[#2988](https://github.com/WolfSoko/wol-sok-mono/issues/2988)
([PR #2995](https://github.com/WolfSoko/wol-sok-mono/pull/2995)); feeds the
search of [#2989](https://github.com/WolfSoko/wol-sok-mono/issues/2989).

## Goal

`GET /api/clubs` keeps its long cache (an hour in the browser, a day in the
CDN) only once the index holds a list for every Verband the DBB offers.
While it is empty or still misses a Verband, the answer is cached as briefly
as the DBB proxy's (a minute in the browser, five minutes in the CDN), so
the first fill shows up within minutes of each hourly crawl, not a day
later. The privacy policy says both, and (#3004) says when a Verband is
crawled again, from the constants that decide it, under an English name.

## Non-goals

- No change to what the crawl reads from the DBB, its order or its pace.
- No change to the answer's body, its 404 for a query or its 502.
- A Verband whose list still holds Team names in place of Club names
  (`nameFromTeam`) counts as present: its Clubs are findable.
- No client change: `ClubIndex` already loads the list once per start.

## Decisions

- **The index itself says whether it is complete.** The server cannot know
  the Verbände the DBB offers without asking the DBB on every cache miss.
  The crawl does know them (its `ligaSuche` at the start of each run), so
  each run marks every offered Verband not marked yet with
  `OFFERED_ASSOCIATION` (`offered: true`): a placeholder
  `clubIndex/{associationId}` where it has no document, merged into an
  existing one; every list it saves carries the mark too. The index is
  complete when it holds at least one document and every document is a
  readable list with the mark. A crawl pending on an existing list
  (`attemptedAt` beside it) still counts: the list is there.
- **`removeUnoffered` deletes every document of an unoffered Verband**, not
  only those with a list: else a placeholder or a failed attempt of a
  Verband the DBB dropped would keep the index "incomplete" for ever. The
  store's state therefore names every document's id (`ids`).
- **The completeness check is pure and in the lib**, beside the stored
  shape it reads: `parseClubIndex(data)` in `basketball-data`'s
  `stored-association-clubs.ts` returns `{ lists, complete }`;
  `parseAssociationClubsList` stays for the functions' store. A document of
  another version counts as not a list, so as incomplete (the safe side).
- **Cache times stay in `src/shared/proxy-cache.ts`:**
  `CLUB_INDEX_CACHE_SECONDS` becomes `{ complete: { browser: 3600, cdn:
  86_400 }, filling: { browser, cdn } }`, `filling` taken from
  `PROXY_CACHE_SEKUNDEN.browser`/`.cdn` (as the issue suggests), so the
  route and the privacy policy keep one source.
- **#3004's crawl days move to the account lib**, which the app and
  `korbjaeger-functions` share already: `CLUB_INDEX_CRAWL_DAYS = { maxAge:
  7, retryAfter: 1 }`. `CLUB_INDEX_SCHEDULE` in the functions' `config.ts`
  builds its milliseconds from it, and the privacy policy renders them with
  `germanDays`. The property `vereinsIndex` becomes `clubIndex` (Coding Rule
  10).
- **Deploy order is safe through the mark.** Lists stored before this
  change carry no mark, so the server calls the index incomplete (short
  cache) until the first run after the release has marked every offered
  Verband; an app deployed before that run cannot call a partial index
  complete (review finding on PR #3021).

## Acceptance

1. With no document, `/api/clubs` answers `[]` with
   `Cache-Control: public, max-age=60, s-maxage=300`.
2. With a placeholder (no list) beside lists, a list without the mark, or a
   document of another version, it answers the lists with the same short
   cache.
3. With a list in every document (an attempt pending beside a list
   included), it answers with `public, max-age=3600, s-maxage=86400`.
4. A query still answers 404 `no-store`, a failed read 502 `no-store`.
5. A run marks each offered Verband not marked yet (a placeholder where it
   has no document, the mark merged into an unmarked list), and none that is
   marked; the crawl's choice of Verband is
   unchanged (a placeholder is due at once, as a missing list was).
6. A run deletes the documents of unoffered Verbände, placeholders and
   attempt-only ones included, and still deletes nothing when the DBB
   offers no Verband.
7. The Firestore store writes and reads placeholders and the mark (emulator
   spec), keeps an unmarked list when marking it, and `save` replaces a
   placeholder with a marked list.
8. The privacy policy, section 3, names both cache times and says the list
   is renewed weekly, a failed crawl a day later, rendered from
   `CLUB_INDEX_CACHE_SECONDS` and `CLUB_INDEX_CRAWL_DAYS`; its spec pins the
   sentences. `vereinsIndex` is gone.
9. `CLAUDE.md`'s club index paragraph names the short cache.
10. `nx affected -t lint,lint-templates,test,typecheck-specs` is green for
    the touched projects; `korbjaeger-functions:test-emulator` is green.

## Open questions

None.
