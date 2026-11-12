# Plan #2955: tools test target runs every `tools/**/*.test.mjs`

Spec: [docs/specs/2955-tools-add-a-test-target-that-runs-tools-test-mjs-grant-admin-test-mjs-runs-nowhere.md](../specs/2955-tools-add-a-test-target-that-runs-tools-test-mjs-grant-admin-test-mjs-runs-nowhere.md)

1. **Widen the target.** In `tools/project.json`, `test.command` becomes
   `node --test "tools/**/*.test.mjs"` and `test.inputs` gains
   `{workspaceRoot}/tools/**/*.mjs`. Test first: `npx nx test tools`
   before the change shows no `parseArgs` suite, after it does (acceptance
   1, 3). Commit `fix(tools): run every tools/**/*.test.mjs in the test
   target`.
2. **Docs.** `CLAUDE.md` (Testing, the `npx nx test tools` mentions) and
   the header of `tools/firebase/grant-admin.test.mjs` name the target. Same
   commit as 1.
3. **Checks.** `npx nx format:write`, `npx nx run-many -p tools -t
   test,lint,typecheck-tools --skip-nx-cache`, `npx nx show project tools
   --json` for acceptance 2.
