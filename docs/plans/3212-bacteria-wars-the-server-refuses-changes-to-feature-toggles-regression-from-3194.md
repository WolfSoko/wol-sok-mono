# Plan: the server refuses changes to feature toggles ([#3212](https://github.com/WolfSoko/wol-sok-mono/issues/3212))

Spec: [docs/specs/3212-bacteria-wars-the-server-refuses-changes-to-feature-toggles-regression-from-3194.md](../specs/3212-bacteria-wars-the-server-refuses-changes-to-feature-toggles-regression-from-3194.md)

## Task 1: the spec holds the SDK's real template (red)

- File: `apps/bacteria-wars-functions/src/admin/toggles.spec.ts`
- Build `template(...)` with `getRemoteConfig(app).createTemplateFromJSON`
  on an `initializeApp({ projectId }, name)` app (deleted after the suite),
  so `etag` is the SDK's getter.
- Add a case: the result of `withToggles` passes the SDK's publish check
  (`publishTemplate` on that `RemoteConfig` with its HTTP client stubbed,
  asserting the `If-Match` ETag, or the input validation it runs first).
- Expect it red on `main` with `ETag must be a non-empty string.`
- Commit together with task 2 (a red commit fails the hook's checks).

## Task 2: withToggles carries the etag over (green)

- File: `apps/bacteria-wars-functions/src/admin/toggles.ts`
- Replace `structuredClone(template)` with a plain copy:
  `{ conditions, parameters, parameterGroups }` deep-copied, `etag` and
  `version` taken through the accessors; doc comment says why.
- Run `npx nx test bacteria-wars-functions`, `lint`, `typecheck-specs`.
- Commit: `fix(bacteria-wars-functions): keep the template's ETag when setting toggles (#3212)`.

## Task 3: spec and plan

- Files: this plan and the spec.
- Commit: `docs(bacteria-wars-functions): spec and plan for the refused toggle changes (#3212)`.
