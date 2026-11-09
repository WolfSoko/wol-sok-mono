# Plan: deploy inputs name the Firebase config literally

Spec: [docs/specs/2904-…](../specs/2904-deploy-inputs-of-pacetrainer-and-rollapolla-analog-miss-their-firebase-config.md)

1. **Guard first (red).** Add `tools/ci/deploy-inputs.test.mjs` (both checks of the spec), add it to the `test` command in `tools/project.json`. Run `npx nx test tools`: it fails on `pacetrainer`, `rollapolla-analog` (`{projectName}` input, missing literal input) and `bacteria-game-remote` (missing input).
2. **Fix the inputs (green).** `apps/pacetrainer/project.json`, `apps/rollapolla-analog/project.json`: literal file names. `apps/bacteria-game-remote/project.json`: `deploy` gets `production`, `^production`, the literal config, `.firebaserc`. Run `npx nx test tools` and the four `nx show projects --affected --files=…` of the acceptance.
3. **Docs.** `CLAUDE.md` Testing: one bullet on the rule and the check.
4. **Checks and commit.** `npx nx format:write`, `npx nx affected -t lint,lint-templates`, `npx nx test tools`. One commit `fix(tools): name each app's Firebase config literally in its deploy inputs` with spec and plan.
