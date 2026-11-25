# shared-error-reports

Error reports to Sentry, the same for every app (owner's decision of
2026-10-26 for the game, since #3236 for the shell `angular-examples` too):
errors only and no personal data. No tracing, Session Replay, sessions or
feedback dialog; no user, IP address, cookies, query or hash; id-like tokens
and the attributes of click breadcrumbs scrubbed.

- `startErrorReports(environment.sentry)` in an app's own `bootstrap.ts`
  loads the SDK by `import()`, off the start's path, and starts it.
  Without options (every build but production) it does nothing.
- `provideErrorReports(environment.sentry)` in the app's providers: Angular's
  `ErrorHandler`, which logs, plus a report once the SDK is there.
- `ErrorReportOptions`: `dsn`, `environment`, `release`
  (`releaseName('<project>')` of `@wolsok/utils-version`), set only in the
  app's `environment.prod.ts`.

Never import it from an exposed module: it is skipped in
`tools/federation/workspace-federation.js`, so each app bundles its own copy
with its own SDK state.

`npx nx test shared-error-reports` runs its specs (Jest).
