# Plan: portfolio (wolsok.de): more professional title, meta description and heading ([#3281](https://github.com/WolfSoko/wol-sok-mono/issues/3281))

Spec: [`docs/specs/3281-…`](../specs/3281-portfolio-wolsok-de-more-professional-title-meta-description-and-heading.md).
Branch `3281-portfolio-professional-title` off `main`, one PR. Paths are under
`apps/portfolio/src/`. The wording is the option the user picked per row.

1. **Red tests first.** (After the review the `index.html` copy was removed instead of kept in step; see the spec's decision 2.)
   - `app/app.component.spec.ts`: a test that reads `../index.html` and
     expects its `<title>`, `meta[name=description]`, `og:title` and
     `og:description` to equal the home route's `title.en` and
     `description.en`; and a test that the start page's `<h1>` and the
     document title follow the language (en, then `de`).
   - Write the new expected texts into the tests first: they fail against
     today's texts.
2. **The new texts.**
   - `app/app.routes.ts`: home `title` and `description` (en, de); D1 builds
     the year from `CAREER_SINCE`.
   - `index.html`: `<title>`, `description`, `og:title`, `og:description`
     take the English texts.
   - `app/i18n/texts.en.ts`, `texts.de.ts`: `home.title`, `home.titleAccent`.
   - Tests: step 1's tests turn green; the rest of the portfolio's specs stay
     green.
   - Commit: `feat(portfolio): introduce wolsok.de as a professional software engineer (#3281)`, with spec and plan in an earlier `docs(portfolio): …` commit.
3. **Checks and PR.** `npx nx format:write`, then
   `npx nx run-many -p portfolio -t lint,lint-templates,test,typecheck-specs`
   and `npx nx build portfolio --configuration production` (budgets,
   prerender); read the prerendered `dist/.../browser/index.html` for title,
   description and `<h1>`. Screenshot of the hero in en and de. Open the PR
   with `Closes #3281` and the acceptance list.
