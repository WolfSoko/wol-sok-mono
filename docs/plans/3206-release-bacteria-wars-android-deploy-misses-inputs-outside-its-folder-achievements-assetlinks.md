# Plan #3206 — bacteria-wars-android deploy inputs

1. **Guard first (red).** `tools/ci/deploy-inputs.test.mjs`: add the test
   "name every file outside the Android app its deploy reads" (closure of
   `deploy-android.ts`' relative imports plus the workspace path literals in
   them, outside `apps/bacteria-wars-android/`), drop `IMPLICIT_DEPLOY_INPUTS`
   and its test. `npx nx test tools` fails on the Android app.
2. **Inputs (green).** `apps/bacteria-wars-android/project.json`: `deploy`
   gets `inputs` (`production` and the eight files). `npx nx test tools` green;
   check acceptance 1-3 with `release-affected.mjs --files`.
3. **Docs.** CLAUDE.md "Deploy inputs" and Android App paragraphs.
4. `npx nx format:write`, `npx nx affected -t lint,lint-templates`, one commit
   `fix(bacteria-wars-android): deploy reads its inputs outside the app (#3206)`
   with spec and plan, PR `Closes #3206`.
