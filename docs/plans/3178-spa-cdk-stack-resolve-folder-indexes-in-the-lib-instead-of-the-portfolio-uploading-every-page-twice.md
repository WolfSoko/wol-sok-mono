# Plan: spa-cdk-stack resolves folder indexes (#3178)

Spec: [docs/specs/3178-…](../specs/3178-spa-cdk-stack-resolve-folder-indexes-in-the-lib-instead-of-the-portfolio-uploading-every-page-twice.md)

1. **Handler, test first.** Replace
   `libs/public/spa-cdk-stack/src/lib/spa/trailing-slash-redirect.ts` and its
   spec with `viewer-request.ts` / `viewer-request.spec.ts`:
   `viewerRequestSource({ redirectTrailingSlash, resolveFolderIndex })`
   returns the CloudFront Function's source. The spec evaluates it for each
   combination: every case of the old spec under `redirectTrailingSlash`, the
   rewrite cases of acceptance 2 under `resolveFolderIndex`, and both together.
2. **Option on the construct.** `SpaProps.resolveFolderIndex`; the construct
   creates one `ViewerRequest` function when either option is on and
   associates it on `VIEWER_REQUEST`. `stack-spa.spec.ts`: one function for
   each option and for both, none by default, code equal to
   `viewerRequestSource`. README section and doc comments. Commit
   `feat(spa-cdk-stack): resolve folder indexes on request`.
3. **Portfolio drops the duplicates.** `apps/portfolio-cdk/src/portfolio.stack.ts`
   sets `resolveFolderIndex: true`, removes the per-depth `addExtraAssets`
   uploads and throws on a page whose folder name holds a dot;
   `prerendered-pages.ts` loses `pagesByDepth` and its spec cases;
   `portfolio.stack.spec.ts` checks one upload per page, no `text/html`
   deployment, the function's code and the dot guard. `CLAUDE.md`'s portfolio
   line updated. Commit `refactor(portfolio-cdk): let the SPA stack resolve
   folder indexes instead of uploading every page twice`.
4. Checks: `nx test spa-cdk-stack`, `nx test portfolio-cdk`,
   `nx run-many -t typecheck-specs -p spa-cdk-stack portfolio-cdk`,
   `nx affected -t lint,lint-templates`, `nx format:write`, local `cdk synth`
   of `portfolio-cdk`.
5. PR with spec, plan and code, `Closes #3178`; review by a fresh subagent,
   acceptance list in the PR, merge request, then watch the deploy and `curl`
   the live URLs (acceptance 7).
