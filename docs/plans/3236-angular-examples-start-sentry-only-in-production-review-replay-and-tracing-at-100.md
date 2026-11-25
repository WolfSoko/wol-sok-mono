# Plan: angular-examples starts Sentry only in production, errors only

Spec: [docs/specs/3236-angular-examples-start-sentry-only-in-production-review-replay-and-tracing-at-100.md](../specs/3236-angular-examples-start-sentry-only-in-production-review-replay-and-tracing-at-100.md). Issue: [#3236](https://github.com/WolfSoko/wol-sok-mono/issues/3236).

Branch `3236-angular-examples-sentry-errors-only` off `main`, one PR.

## Task 1: shared lib `shared-error-reports` from the game's module

- Generate `libs/shared/error-reports` (Nx Angular/Jest library generator, tag `shared`, alias `@wolsok/shared-error-reports`, MIT `package.json` as `shared-legal`).
- `git mv` `apps/bacteria-game-remote/src/app/error-reports/{error-reports,scrub,sdk}.ts` and `scrub.spec.ts` into `libs/shared/error-reports/src/lib/`; export `ErrorReportOptions`, `sentryOptions`, `startErrorReports`, `reportError`, `provideErrorReports`, `scrubEvent`, `scrubBreadcrumb` from `src/index.ts`. Comments: say why (personal data), with the game as one example, not as the only reason.
- Split `error-reports.spec.ts`: the generic cases (no options, options, integrations, early error, handler) move with the lib; the game keeps a spec `apps/bacteria-game-remote/src/environments/environment.spec.ts` ("start only on the live site") over its environments.
- Game: `bootstrap.ts`, `app.config.ts`, `environment.type.ts` import from `@wolsok/shared-error-reports`; remove the empty `src/app/error-reports/`.
- `tools/federation/workspace-federation.js`: skip `@wolsok/shared-error-reports` beside `@sentry/angular`, with the reason.
- Tests: `nx test shared-error-reports`, `nx test bacteria-game-remote`, `nx typecheck-specs` of both, lint.
- Commit `refactor(shared-error-reports): move the game's error reports into a shared lib`.

## Task 2: angular-examples on the shared lib, production only

- Test first: `apps/angular-examples/src/environments/environment.spec.ts`: the production environment has `sentry` with the `angular-examples` DSN (`o1384048.ingest.sentry.io/6702682`), environment `production`, release `angular-examples@<version>`; the development one has none.
- `environment.type.ts`: `sentry?: ErrorReportOptions`; `environment.prod.ts`: the block, DSN moved out of `bootstrap.ts`.
- `bootstrap.ts`: `startErrorReports(environment.sentry)` replaces `init`; the Replay, tracing and `@sentry/angular` imports go.
- `core/core.module.ts`: `provideErrorReports(environment.sentry)` replaces `createErrorHandler({ showDialog: true })`, `TraceService` and its app initializer go.
- Tests: `nx test angular-examples`, `nx typecheck-specs angular-examples`, lint, lint-templates; `nx build angular-examples -c production` within its budgets.
- Commit `fix(angular-examples): report errors to Sentry from production only, without Replay, tracing or personal data`.

## Task 3: lower the shell's budgets

- Read the production build's sizes (`initial`, `anyScript`, `allScript`) and lower the `baseline`s in `apps/angular-examples/project.json` to them, if they fell; same check for the game's (no change expected).
- Commit `perf(angular-examples): lower the budgets by the Sentry code no longer bundled`, sizes before and after in the PR body.

## Task 4: CLAUDE.md

- Sentry paragraph under Native Federation: the shell starts the shared lib from `bootstrap.ts` and `core/core.module.ts` only where the environment has a `sentry` block, the same options as the game (`libs/shared/error-reports`); the lib is skipped in `workspace-federation.js`.
- Commit `docs(...)`: scope `angular-examples` (`chore(angular-examples): ...`), since `docs` is no valid scope.

## Task 5: check

- `npx nx format:write`, `npx nx affected -t build,test,lint,lint-templates,typecheck-specs`.
- Serve the shell in development and check that the page sends no request to `ingest.sentry.io`.
