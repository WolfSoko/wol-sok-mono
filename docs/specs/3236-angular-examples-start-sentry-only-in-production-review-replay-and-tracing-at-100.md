# Spec: angular-examples starts Sentry only in production, errors only

Issue: [#3236](https://github.com/WolfSoko/wol-sok-mono/issues/3236). Related: [#3202](https://github.com/WolfSoko/wol-sok-mono/issues/3202), [PR #2690](https://github.com/WolfSoko/wol-sok-mono/pull/2690).

## Goal

The shell `angular-examples` reports errors to its Sentry project only from the production build, and only errors, without personal data: the same rule the game follows since PR #2690 (CLAUDE.md, Native Federation, "Error reports go to Sentry").

Today `apps/angular-examples/src/bootstrap.ts` calls `init` on every build with an inline DSN, Session Replay at 100% of sessions and errors, `browserTracingIntegration()` with `tracesSampleRate: 1.0`, release health and the SDK's default data collection (Sentry infers the IP address). `core/core.module.ts` adds Sentry's `ErrorHandler` with `showDialog: true` (the user feedback dialog asks for name and email) and the `TraceService`. So every `nx serve` and every e2e run, on the CI workers too, sends envelopes to the production project.

## Non-goals

- A privacy policy for `angularexamples.wolsok.de`: the site has none today (raised to the manager as a follow-up).
- Error reports of the remotes when loaded in the shell: they stay the shell's.
- Changes to what the game sends: its behaviour stays byte-for-byte the same, only its code moves.
- Keeping the production build that Lighthouse serves on `localhost` in CI from reporting: it reports only an error, and the start page throws none.

## Decisions

1. **A `sentry` block only in `environment.prod.ts`.** `Environment` gets `sentry?: ErrorReportOptions` (`dsn`, `environment: 'production'`, `release: angular-examples@<version>`, the name `.github/actions/create-release` creates). `environment.ts` has none, so development and e2e (which serve the development configuration) start nothing and provide no Sentry `ErrorHandler`. Reason: the issue's first point; the game does the same.
2. **No Session Replay.** Neither on sessions nor on errors. Reason: a replay records the page, typed text included, and the site has no privacy policy that could name it; the owner's rule for the game (2026-10-26) is errors only.
3. **No tracing.** `browserTracingIntegration`, `tracesSampleRate`, `tracePropagationTargets` and the `TraceService` go. Reason: errors only; the performance gates of ADR 0014 measure performance in CI instead.
4. **No personal data.** The game's `dataCollection` (no user info, IP address, cookies, query, bodies; only the `User-Agent` header), no release health (`BrowserSession`), no console breadcrumbs, `beforeSend`/`beforeBreadcrumb` scrubbing (user dropped, URLs without query and hash, id-like tokens replaced, click breadcrumbs without attributes). Reason: the issue's `sendDefaultPii` point; SDK 11 replaced that flag by `dataCollection`.
5. **No feedback dialog.** The handler logs the error (Angular's `ErrorHandler`) and reports it; `showDialog` goes. Reason: the dialog collects name and email.
6. **The SDK loads by `import()`**, off the start's path, and errors from before it loaded wait for it, as in the game. Reason: the shell's `initial` budget; Replay and tracing were most of the Sentry code in `main`.
7. **One shared lib instead of a copy.** The game's `src/app/error-reports/` (options, scrubbing, start, handler, SDK entry, specs) moves into a new lib `shared-error-reports` (`libs/shared/error-reports`, tag `shared`, alias `@wolsok/shared-error-reports`), which both apps take; the comments name no game-specific details as the only reason. It is skipped in `tools/federation/workspace-federation.js` beside `@sentry/angular`, so each app bundles its own copy with its own SDK state. Reason: Clean Code (no copy-paste of 200 lines and their specs); the game moves along since the rule is the same.
8. **Budgets.** The shell's `production` budgets get lowered by what the build no longer bundles, in a `perf(angular-examples): ...` commit of its own (ADR 0014 rules: lower a baseline when a gate reports a gain). The game's budgets stay unless its measured sizes move.
9. **CLAUDE.md** names the new lib in the Sentry paragraph (where the shell starts it, which lib holds the options).

## Acceptance

1. A development build (`nx serve angular-examples`, its e2e) calls no Sentry `init` and sends no envelope; no Sentry `ErrorHandler` is provided. Checked by specs of the shell's error-report wiring and by the absence of `ingest.sentry.io` requests in a served dev page.
2. The production build starts Sentry with the `angular-examples` DSN, environment `production` and release `angular-examples@<version>`.
3. The options passed to `init` hold no Replay, no tracing (`tracesSampleRate`, tracing integration), no `BrowserSession`/`Console` integration, and the game's `dataCollection`; specs check it.
4. `ErrorHandler` is no `showDialog` handler; an Angular error is logged and reported once the SDK has loaded.
5. The game's specs for its error reports pass from the shared lib unchanged in substance; the game's `app.config.ts` and `bootstrap.ts` start it as before.
6. `npx nx affected -t build,test,lint,lint-templates,typecheck-specs` is green; the shell's production build stays within its (lowered) budgets.

## Open questions

- None blocking. The manager may choose to keep Replay on errors only (`replaysOnErrorSampleRate`); this spec recommends none until the site has a privacy policy.
