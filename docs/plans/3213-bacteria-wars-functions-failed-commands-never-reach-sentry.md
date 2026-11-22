# Plan: failed commands never reach Sentry ([#3213](https://github.com/WolfSoko/wol-sok-mono/issues/3213))

Spec: [docs/specs/3213-bacteria-wars-functions-failed-commands-never-reach-sentry.md](../specs/3213-bacteria-wars-functions-failed-commands-never-reach-sentry.md)

## Task 1: `runCommandDocument` rethrows after writing `internal`

- Test first: `src/commands/commands.emulator.ts`, the case "answers
  internal for a command that throws" expects the call to reject with the
  thrown error, and the stored result to be `internal`.
- Code: `src/commands/run-command-document.ts`: write the result, then
  throw the caught error on; update its doc comment (step 2).
- Commit: `fix(bacteria-wars-functions): rethrow a failed command after its result, so Sentry reports it`

## Task 2: `runAudited` rethrows after completing the audit

- Test first: `src/admin/admin.emulator.ts`, `toggles.set` with a
  `RemoteToggles` fake whose `update` throws: `runAdminCommand` rejects
  with that error, `adminAudit/{id}` holds `ok: false, error: 'internal'`,
  and `adminCommands/{id}.result` is `internal`.
- Code: `src/admin/records.ts`: complete the audit as failed, then throw
  on; drop its `logger.error`; update the doc comment.
- Same commit as task 1 (one behaviour).

## Task 3: docs

- `CLAUDE.md`, Cloud Functions: `runCommandDocument` "turns a throw into
  `internal`, writes `result` back and throws it on for `withSentry`".
- Commit with the code.

## Checks

`npx nx run-many -p bacteria-wars-functions -t test,test-emulator,lint,typecheck-specs`, `npx nx format:write`.
