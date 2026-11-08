# Plan #2838: Functions deploy fails a release on a single transient Cloud Functions error

Spec: [docs/specs/2838-…](../specs/2838-functions-deploy-fails-a-release-on-a-single-transient-cloud-functions-error.md)

## Task 1: retry decision, test first

- Files: `apps/bacteria-wars-functions/deploy/run-with-one-retry.spec.ts`,
  `apps/bacteria-wars-functions/deploy/run-with-one-retry.ts`.
- Specs for acceptance 2 to 5 against a fake `run` (scripted results) and a
  recorded `pause`/`log`; then `runWithOneRetry` to make them pass.

## Task 2: runner entry point

- Files: `apps/bacteria-wars-functions/deploy/retry-once.ts`.
- Spawns the command from `process.argv` with `stdio: 'inherit'`, pauses with
  a timer, exits with the decision's code; usage error (code 2) without a
  command (spec for acceptance 6 on the argument parsing, `deploy/retry-once.spec.ts`).
- `tsconfig.app.json` includes `deploy/**/*.ts`, `tsconfig.spec.json` `deploy/**/*.spec.ts`.

## Task 3: wire the target and document

- `apps/bacteria-wars-functions/project.json`: `deploy` runs
  `tsx apps/bacteria-wars-functions/deploy/retry-once.ts firebase deploy …`
  (same arguments as now).
- `CLAUDE.md`, Cloud Functions section: the deploy target runs through the
  runner, one retry after 30 s.

## Task 4: checks and commit

- `npx nx run-many -t test,lint -p bacteria-wars-functions`; run the runner
  by hand with `false`, `true` and a command that fails once (a marker file).
- `npx nx format:write` (oxfmt at the locked version), `npx nx affected -t lint,lint-templates`.
- One commit `fix(bacteria-wars-functions): retry the functions deploy once on failure`
  with spec and plan; PR to `main` with `Closes #2838`.
