# Plan: trailing-slash redirect for wolsok.de (#3171)

Spec: [docs/specs/3171-…](../specs/3171-wolsok-de-trailing-slash-urls-career-blog-fall-back-to-the-home-page.md)

1. **Handler, test first.** `libs/public/spa-cdk-stack/src/lib/spa/trailing-slash-redirect.ts`
   exports `TRAILING_SLASH_REDIRECT_SOURCE` (the CloudFront Function's
   `handler`); `trailing-slash-redirect.spec.ts` evaluates the string and
   checks the cases of acceptance 2.
2. **Option on the construct.** `SpaProps.redirectTrailingSlash`; the
   construct creates the `Function` and associates it with the default
   behaviour on `VIEWER_REQUEST`. Spec in `stack-spa.spec.ts` (acceptance 1).
   README section. Commit `feat(spa-cdk-stack): redirect trailing-slash URLs
   to their bare path on request`.
3. **Portfolio opts in.** `apps/portfolio-cdk/src/main.ts` sets
   `redirectTrailingSlash: true`, comment updated; `CLAUDE.md`'s portfolio
   line names it. Commit `fix(portfolio-cdk): redirect trailing-slash URLs to
   the bare page`.
4. Checks: `nx test spa-cdk-stack`, `nx test portfolio-cdk`, `typecheck-specs`,
   `lint`, `format:write`; `cdk synth` of portfolio-cdk if it runs locally.
5. PR with spec, plan and code, `Closes #3171`; review, test list, merge,
   then `curl -sI` the live URLs (acceptance 5).
