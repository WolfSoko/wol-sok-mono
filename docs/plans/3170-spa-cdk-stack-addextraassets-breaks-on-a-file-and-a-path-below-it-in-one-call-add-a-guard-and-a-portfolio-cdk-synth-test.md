# Plan: guard `addExtraAssets` against a file and a path below it in one call

Spec: [docs/specs/3170-….md](../specs/3170-spa-cdk-stack-addextraassets-breaks-on-a-file-and-a-path-below-it-in-one-call-add-a-guard-and-a-portfolio-cdk-synth-test.md).

1. **Guard in spa-cdk-stack** (test first)
   - Files: new `libs/public/spa-cdk-stack/src/lib/spa/deployment-sources.ts`
     (`assertNoFileIsAnotherSourcesFolder(deployment)`, reading the `Asset` children's staged
     folders), called in `addUpload` of `spa.construct.ts`; JSDoc on `addExtraAssets`;
     `libs/public/spa-cdk-stack/README.md`.
   - Tests: `stack-spa.spec.ts`: one call with `blog` and `blog/x` throws naming `blog`; two calls
     pass; disjoint `Source.data`/`Source.asset` sources pass; snapshots unchanged.
   - Commit: `fix(spa-cdk-stack): refuse a file and a path below it in one addExtraAssets call`.
2. **portfolio-cdk synth test**
   - Files: new `apps/portfolio-cdk/src/portfolio.stack.ts` (`createPortfolioStack`), `main.ts`
     calling it, new `portfolio.stack.spec.ts`.
   - Tests: synth from a temp build output with `career`, `blog`, `blog/<slug>`; extra deployments
     per depth with `no-cache` and `text/html`.
   - Commit: `test(portfolio-cdk): synthesize the stack from a build output with nested pages`.
3. **Docs**: spec and plan in the first commit's PR (`docs(spa-cdk-stack): …` is not needed; they
   ride with commit 1).

Checks before each commit: `npx nx format:write`, `npx nx affected -t lint,lint-templates,test,typecheck-specs`.
