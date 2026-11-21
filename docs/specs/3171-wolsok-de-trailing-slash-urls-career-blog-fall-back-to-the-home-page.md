# wolsok.de: trailing-slash URLs fall back to the home page

Issue: [#3171](https://github.com/WolfSoko/wol-sok-mono/issues/3171). Related:
[#3159](https://github.com/WolfSoko/wol-sok-mono/issues/3159),
[#3169](https://github.com/WolfSoko/wol-sok-mono/pull/3169).

## Goal

A request for a portfolio page with a trailing slash (`/career/`, `/blog/`,
`/blog/<slug>/`) gets a permanent redirect to the page's bare path
(`/career`, `/blog`, `/blog/<slug>`), which `portfolio-cdk` uploads and the
sitemap and canonical tags name. Today such a URL has no S3 key, falls through
the distribution's `403 -> /index.html` error response and serves the home
page's HTML with status 200 under the wrong URL.

## Non-goals

- No change for the other SPA stacks (`angular-examples-cdk`, the remotes'
  CDK apps): they keep their behaviour unless they opt in.
- No change to the `403 -> /index.html` fallback for unknown paths.
- No rewrite to `/x/index.html`: that would serve one page under two URLs.

## Decisions

1. **Redirect, not rewrite.** A `301` to the bare path keeps one URL per page,
   the one the sitemap, canonical and Open Graph tags carry. A rewrite would
   answer `/career/` with the page too, duplicate content for crawlers.
2. **A CloudFront Function on viewer request**, in `@wolsok/spa-cdk-stack`, as
   an opt-in `SpaProps` option `redirectTrailingSlash` (default off). The
   distribution is private to `SpaConstruct`, so the portfolio cannot attach
   it from outside without widening the construct's interface, and the
   redirect is a property of the distribution. The option is new, so the
   published package gets a minor release (`feat(spa-cdk-stack)`); its
   targets are not touched.
3. **The handler's source is a string constant** in its own module
   (`trailing-slash-redirect.ts`), deployed with `FunctionCode.fromInline` on
   runtime `cloudfront-js-2.0`, and the spec evaluates that very string, so
   the tested code is the deployed code (a `Function.toString()` of compiled
   TypeScript could differ from what the spec ran).
4. **What redirects:** a URI longer than `/` that ends in `/`. All trailing
   slashes go (`/blog//` to `/blog`; `//` to `/`). The query string is kept,
   every value of a repeated key too, so campaign parameters survive. The
   `Location` is a path (no host), which browsers and crawlers resolve
   against the request.
5. `/` itself is untouched; it is the default root object.

## Acceptance

1. With `redirectTrailingSlash: true` the synthesized distribution has one
   CloudFront Function (`cloudfront-js-2.0`) associated as `viewer-request`
   with the default behaviour; without it there is none (existing snapshots
   unchanged).
2. The handler answers `/career/` with `301` and `Location: /career`,
   `/blog/x/` with `/blog/x`, keeps `?a=1&b=2&b=3`, and passes `/`, `/career`,
   `/main-ABC.js` on unchanged.
3. `portfolio-cdk` sets `redirectTrailingSlash: true`.
4. README of `spa-cdk-stack` and `CLAUDE.md` (portfolio) describe it.
5. After the deploy, `curl -sI https://wolsok.de/career/` answers `301` with
   `location: /career`, and `https://wolsok.de/career` still `200`.

## Open questions

None.
