# Spec: wolsok.de answers unknown paths with a 404 page ([#3195](https://github.com/WolfSoko/wol-sok-mono/issues/3195))

Related: [#3178](https://github.com/WolfSoko/wol-sok-mono/issues/3178),
[#3171](https://github.com/WolfSoko/wol-sok-mono/issues/3171),
[PR #3177](https://github.com/WolfSoko/wol-sok-mono/pull/3177),
[PR #2459](https://github.com/WolfSoko/wol-sok-mono/pull/2459).

## Goal

`SpaConstruct` (`libs/public/spa-cdk-stack/src/lib/spa/spa.construct.ts`,
`createDistribution`) has one hardcoded error response: S3's `403` becomes
`/index.html` with status `200`. Behind Origin Access Control S3 answers `403`
for every missing key, so on the prerendered portfolio (wolsok.de) any unknown
path, `/nope` or `/blog/typo`, serves the home page with `200` under the wrong
URL: a soft 404 for crawlers. In the browser the router then redirects `**` to
`/`, so a visitor never learns the link was wrong either.

After the change a prerendered site can name a not-found page: CloudFront
answers every miss with that page and status `404`. The portfolio gets such a
page, prerendered, `noindex`, in English and German, with a link home.

## Non-goals

- No change for plain SPAs (`angular-examples-cdk`, the remotes' CDK apps):
  without the new option they keep the `index.html` fallback with `200`,
  which their client-side routing needs.
- No server-side check of the path: CloudFront only sees that S3 has no key.
- `/404` itself (the prerendered page's own URL) stays reachable with `200`,
  like every prerendered page behind `resolveFolderIndex`; it is `noindex`
  and in no sitemap. A redirect or a special case for it is not worth the
  CloudFront Function code.
- Bacteria Wars and RollaPolla are on Firebase Hosting and are not touched.

## Decisions

1. **A new opt-in `SpaProps` option `notFoundPage`**: the page's path
   relative to `buildOutputPath`, say `404/index.html`. With it the
   distribution maps S3's `403` and `404` to `/<notFoundPage>` with status
   `404`; without it the error responses stay exactly as they are (`403` to
   `/index.html`, `200`), so the published package changes nothing for
   existing users (a `feat`, minor bump). `404` is mapped as well, since S3
   answers it instead of `403` where the bucket policy grants `s3:ListBucket`.
   Reason: the issue's idea, next to the opt-in `redirectTrailingSlash` and
   `resolveFolderIndex`; the site decides which page, the construct how it
   is served.
2. **The construct refuses a `notFoundPage` that is not in the build output**
   at synth (an `Error` naming the path), and one starting with `/`. Reason:
   CloudFront would otherwise answer every miss with its own error page, and
   the release would deploy fine; the portfolio's deploy synthesises on the
   real build, so a renamed page fails the release instead.
3. **The error responses' TTL stays 30 minutes** (one constant for both
   cases). Every deployment invalidates `/*`, which clears cached errors too,
   so a page added by a release is not hidden by a cached 404.
4. **The portfolio's catch-all route renders a `NotFoundComponent`**
   instead of redirecting to `/`, so the page also shows in the browser after
   hydration under the URL the visitor typed. It is prerendered once through
   the server route's `getPrerenderParams` for `**` (`{ '**': '404' }`),
   written as `404/index.html`; no second client route `404`. Reason: one
   route, one component, the same DOM before and after hydration.
5. **`PageData` gets `noindex?: true`**: `SeoService` sets
   `<meta name="robots" content="noindex">` and drops the canonical link for
   such a page, and removes the robots tag again on the next page. The
   not-found page's title and description are its own (both languages).
6. **`portfolio-cdk` passes `notFoundPage: '404/index.html'`.** The page is
   already uploaded `no-cache` like every prerendered page
   (`resolvablePages`), so a release replaces it at once.
7. Sitemap and Lighthouse lists stay as they are: both specs leave `**` out
   already, and the not-found page is no page to index or measure.

## Acceptance

1. `SpaConstruct` without `notFoundPage` synthesises the same error
   responses as before (snapshot unchanged).
2. With `notFoundPage: '404/index.html'` the distribution maps `403` and
   `404` to `/404/index.html` with response code `404`, TTL 30 minutes.
3. Synth fails with a clear message for a `notFoundPage` missing from
   `buildOutputPath` or starting with `/`.
4. The portfolio stack synthesises with `notFoundPage: '404/index.html'`, and
   its spec checks the error responses.
5. The portfolio build writes `dist/apps/portfolio/404/index.html`, holding
   the not-found text, `noindex` and no canonical link.
6. In the browser an unknown path (`/nope`) shows the not-found page under
   `/nope`, with a working link home; the router no longer redirects it to
   `/`.
7. Navigating from the not-found page to another page removes the `noindex`
   tag and sets that page's canonical link again.
8. The README of `spa-cdk-stack` describes the option.
9. After the deploy, `curl -sI https://wolsok.de/nope` answers `404` and
   `curl -s https://wolsok.de/nope` serves the not-found page;
   `https://wolsok.de/career` still answers `200`.

## Open questions

None.
