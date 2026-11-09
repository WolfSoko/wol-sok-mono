# Plan #2846: Lint rule: no direct reads of version.json outside @wolsok/utils-version

Spec: [docs/specs/2846-…](../specs/2846-lint-rule-no-direct-reads-of-version-json-outside-wolsok-utils-version.md).
Lands after PR [#2843](https://github.com/WolfSoko/wol-sok-mono/pull/2843).

1. **Spec harness and failing cases.** `tools/oxlint/workspace-rules.spec.mjs`
   (`node:test`): writes each case into a temp folder, runs
   `node_modules/.bin/oxlint -f json` with a config loading
   `workspace-rules.mjs` and only `wolsok/no-version-json-read`, asserts the
   reported lines. Cases from acceptance 1–2. `test` target in
   `tools/oxlint/project.json` (`node --test tools/oxlint/*.spec.mjs`, cached,
   inputs the folder and `node_modules/oxlint`). Red.
2. **The rule.** `noVersionJsonRead` in `workspace-rules.mjs`: `ImportDeclaration`,
   `ExportNamedDeclaration`/`ExportAllDeclaration`, `ImportExpression` and
   `require()` sources; `Literal` / `TemplateLiteral` naming the file, walked up
   through call arguments, template and `+` expressions to a `read…` callee.
   Green. Commit `feat(oxlint-workspace-rules): forbid direct reads of version.json`.
3. **Wire it up.** `.oxlintrc.json`: `"wolsok/no-version-json-read": "error"`,
   override `libs/utils/version/**` → `off`. Run `npx nx run-many -t lint` on
   `main` + #2843 and check that only the lib is exempt and nothing else is hit.
   CLAUDE.md bullet. Same commit or `chore(oxlint-workspace-rules): …`.
4. **Checks.** `npx nx format:write` with the pinned oxfmt, `npx nx affected
   -t lint,lint-templates,test`, hand mutation of acceptance 5. PR with
   `Closes #2846`.
