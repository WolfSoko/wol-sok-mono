# Spec: spa-cdk-stack resolves folder indexes itself ([#3178](https://github.com/WolfSoko/wol-sok-mono/issues/3178))

Related: [#3171](https://github.com/WolfSoko/wol-sok-mono/issues/3171),
[#3170](https://github.com/WolfSoko/wol-sok-mono/issues/3170),
[PR #3177](https://github.com/WolfSoko/wol-sok-mono/pull/3177),
[PR #3169](https://github.com/WolfSoko/wol-sok-mono/pull/3169).

## Goal

CloudFront in front of S3 (Origin Access Control) resolves no folder index:
`/career` finds no key `career` and falls back to the home page. So
`apps/portfolio-cdk/src/portfolio.stack.ts` uploads every prerendered page a
second time under its bare key (`Source.data(page, …)`), one deployment per
depth (`pagesByDepth`), because a file `blog` and a folder `blog/` cannot share
one deployment.

After the change `@wolsok/spa-cdk-stack` resolves folder indexes itself: the
viewer-request CloudFront Function that `redirectTrailingSlash` added (#3171)
also rewrites an extension-less path to its `index.html`, `/career` to
`/career/index.html`. Each page is stored once, under the key the build wrote,
and the portfolio drops its duplicate uploads and `pagesByDepth`.

## Non-goals

- The soft 404: every miss still answers `200` with the home page (the
  distribution's `403 -> /index.html` error response). That is its own issue,
  [#3195](https://github.com/WolfSoko/wol-sok-mono/issues/3195).
- No change for the other SPA stacks (`angular-examples-cdk`, the remotes'
  CDK apps): they opt into nothing and keep their distribution as it is.
- No cleanup of the bare-key objects the portfolio uploaded so far: the
  deployments never prune, and no request reaches them once the rewrite is
  live. They can be deleted by hand.
- `/career/index.html` stays reachable as it was before; no redirect for it.

## Decisions

1. **A new opt-in `SpaProps` option `resolveFolderIndex`** (default `false`):
   "serve `/about` from `about/index.html`". A path whose last segment has no
   `.` and that does not end in `/` gets `/index.html` appended to its URI, a
   rewrite inside CloudFront, so the browser keeps `/about` and the query
   string stays as it came. A path ending in `/` (other than `/`) is rewritten
   to `<path>index.html` too, unless `redirectTrailingSlash` is on, which
   still answers it with the `301` to the bare path first. `/` is untouched
   (the default root object). The option is new, so the published package
   gets a minor release (`feat(spa-cdk-stack)`); its targets stay.
2. **One CloudFront Function for both options.** A cache behaviour takes only
   one function per event type, so `redirectTrailingSlash` and
   `resolveFolderIndex` share one viewer-request function, created when
   either is on. Its source is built by `viewerRequestSource(options)` in a
   module of its own (`viewer-request.ts`, replacing
   `trailing-slash-redirect.ts`): the handler text with the two switches as
   literals at its top, so the spec evaluates exactly the string that is
   deployed for each combination, as #3171 decided. Its construct id becomes
   `ViewerRequest` (comment names what it does); the rename replaces the
   portfolio's function once at the deploy, which CloudFormation does by
   creating the new one before deleting the old.
3. **Extension-less means no `.` in the last segment.** `/main-ABC.js`,
   `/blog/x/nat-walls.svg`, `/ads.txt` pass unchanged. A page whose folder name
   holds a dot (`/blog/v1.2`) would not be resolved, so `portfolio-cdk` fails
   at synth on such a page rather than deploying a page nobody reaches The
   lib exports the rule as `servesFolderIndex(path)`, which the portfolio's
   check calls and the spec holds equal to the deployed function.
4. **`redirectTrailingSlash`'s doc comment loses its "only for sites that
   upload their pages under bare paths" rule**: with `resolveFolderIndex` the
   bare path resolves without such uploads. The README says to use both
   together for prerendered sites.
5. **The portfolio keeps its pages no-cache** through `noCacheFiles`
   (`<page>/index.html`, from `prerenderedPages`); their `Content-Type` comes
   from the `.html` extension, as for every other file of the build, so the
   explicit `text/html; charset=utf-8` uploads go. `pagesByDepth`, its spec
   and the per-depth `addExtraAssets` calls are removed.
6. **The `addExtraAssets` guard of #3170 stays** in the lib: it protects any
   caller, not only the portfolio. Its README example keeps the bare-path
   pages as an illustration of the clash, but now notes that
   `resolveFolderIndex` makes such uploads unnecessary.

## Acceptance

1. With `resolveFolderIndex: true` the synthesized distribution has exactly
   one CloudFront Function (`cloudfront-js-2.0`) as `viewer-request` on the
   default behaviour, and its code is `viewerRequestSource` of the options
   given; with both options on there is still one; with neither there is
   none (the existing snapshots stay unchanged).
2. The handler, evaluated from its deployed source:
   - with `resolveFolderIndex`: `/career` → `/career/index.html`,
     `/blog/bacteria-wars-turn-relay` →
     `/blog/bacteria-wars-turn-relay/index.html`, `/career/` →
     `/career/index.html`; `/`, `/main-ABC.js`, `/blog/x/nat-walls.svg`,
     `/ads.txt` unchanged; the query string untouched;
   - with both: `/career/` → `301` to `/career` (every case of #3171 still
     holds), `/career` → `/career/index.html`;
   - with `redirectTrailingSlash` only: behaviour exactly as today.
3. `portfolio-cdk` sets `resolveFolderIndex: true` and
   `redirectTrailingSlash: true`; its synthesized stack holds no
   `text/html` bare-key deployment, each page is uploaded once (as
   `<page>/index.html`, no-cache), and a page whose folder name holds a `.`
   fails the synth.
4. `pagesByDepth` and its spec are gone; `prerenderedPages` stays.
5. The lib's README, the doc comments and `CLAUDE.md`'s portfolio line
   describe the new behaviour.
6. `nx test spa-cdk-stack`, `nx test portfolio-cdk`, `typecheck-specs`, lint
   and format pass; a local `cdk synth` of `portfolio-cdk` (as L214
   describes) succeeds.
7. After the deploy: `curl -sI https://wolsok.de/career` answers `200` with
   the career page (its `<title>`), `/career/` answers `301` to `/career`,
   `/blog/bacteria-wars-turn-relay` answers `200` with the article, `/` the
   home page. A page that had only its bare-key copy before (`/privacy`) is
   fetched under its old URL through the CDN after the deploy's invalidation
   (`/*`, which the last deployment waits for) and serves the page from
   `privacy/index.html`. An asset (`/main-*.js`) and `/ads.txt` still answer
   `200` with their content type.

## Open questions

None.
