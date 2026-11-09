# Plan: Lint guard: keep /testing entry points out of production code ([#2898](https://github.com/WolfSoko/wol-sok-mono/issues/2898))

Spec: [docs/specs/2898-…](../specs/2898-lint-guard-keep-testing-entry-points-out-of-production-code.md)

1. **Spec cases first** — `tools/oxlint/workspace-rules.spec.mjs`: let
   `reportedCodes` take a file path (so a case can be `foo.spec.ts` or
   `testing/fake.ts`), enable `wolsok/no-testing-import` in the temp config,
   add reported and allowed cases. Run `npx nx test oxlint-workspace-rules`:
   the new cases fail. No commit yet.
2. **The rule** — `tools/oxlint/workspace-rules.mjs`: `noTestingImport` with
   the source matcher and the test-file matcher, registered as
   `no-testing-import`. Spec green.
   Commit: `feat(oxlint-workspace-rules): forbid testing imports in production code`.
3. **Turn it on** — `.oxlintrc.json`: override for `apps/*/src/**` and
   `libs/**/src/**` setting `wolsok/no-testing-import` to `error`. Run
   `npx nx run-many -t lint` to show no production file imports testing code
   today; a throwaway import in a production file of the admin lib shows lint
   failing (not committed). `CLAUDE.md`: name the rule in "Linting &
   Formatting".
   Commit: `chore(nx): lint testing imports in production sources`.
4. Format, affected lint/test, PR with spec, plan, code; `Closes #2898`.
