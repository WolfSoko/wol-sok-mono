# Plan: wolsok.de answers unknown paths with a 404 page ([#3195](https://github.com/WolfSoko/wol-sok-mono/issues/3195))

Spec: [docs/specs/3195-wolsok-de-unknown-paths-answer-200-with-the-home-page-soft-404.md](../specs/3195-wolsok-de-unknown-paths-answer-200-with-the-home-page-soft-404.md)

## 1. `spa-cdk-stack`: opt-in `notFoundPage`

- Files: `libs/public/spa-cdk-stack/src/lib/spa/spa.construct.ts` (new
  `SpaProps.notFoundPage`, error responses built by one small function, synth
  check of the path), `libs/public/spa-cdk-stack/src/lib/stack-spa.spec.ts`,
  `libs/public/spa-cdk-stack/README.md`.
- Tests first: without the option the error responses are unchanged
  (existing snapshot); with it `403` and `404` map to `/404/index.html` with
  `404`; a missing file and a leading `/` throw at synth.
- Commit: `feat(spa-cdk-stack): serve a not-found page with status 404 for prerendered sites`.

## 2. Portfolio: not-found page

- Files: `apps/portfolio/src/app/not-found/not-found.component.ts` (+ html,
  scss, spec), `app.routes.ts` (`**` renders it, data with `noindex`),
  `app.routes.server.ts` (`getPrerenderParams` for `**`), `page-data.ts`
  (`noindex`), `seo.service.ts` (+ spec: robots tag, canonical dropped and
  restored), `i18n/texts.en.ts`, `i18n/texts.de.ts`.
- Tests first: the component renders the text and a link home; the SEO spec
  for `noindex` on and off; the routes spec that `/nope` renders the page.
- Check: `npx nx build portfolio` writes `404/index.html` with the tags.
- Commit: `feat(portfolio): show a not-found page for unknown paths`.

## 3. `portfolio-cdk`: use the page

- Files: `apps/portfolio-cdk/src/portfolio.stack.ts`,
  `portfolio.stack.spec.ts` (fake build gets `404/index.html`; error
  responses checked).
- Commit: `feat(portfolio-cdk): answer unknown paths with the 404 page`.

## 4. Docs and checks

- `CLAUDE.md` portfolio bullet: one sentence on the not-found page.
- `npx nx format:write`, `npx nx affected -t lint,lint-templates,test,typecheck-specs,build`.
- PR with `Closes #3195`, review, acceptance list in the PR body.
