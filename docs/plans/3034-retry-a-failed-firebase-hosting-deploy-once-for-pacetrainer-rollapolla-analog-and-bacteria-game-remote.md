# Plan: retry the three remaining Hosting deploys once (#3034)

Spec: [docs/specs/3034-retry-a-failed-firebase-hosting-deploy-once-for-pacetrainer-rollapolla-analog-and-bacteria-game-remote.md](../specs/3034-retry-a-failed-firebase-hosting-deploy-once-for-pacetrainer-rollapolla-analog-and-bacteria-game-remote.md).

1. **Spec first: every Hosting deploy is retried and runs no nested Nx.**
   Files: `tools/deploy/deploy-targets.spec.ts`.
   Test first: the per-app case expects the next-to-last command to start with the retried `firebase --config=firebase.<app>.json --project=<app> deploy`, and no command to contain `nx run`; red for pacetrainer, rollapolla-analog and bacteria-game-remote, green for korbjaeger.
   Check: `npx nx test tools-deploy` (red as expected).

2. **Route the three deploys through the helper.**
   Files: `apps/pacetrainer/project.json`, `apps/rollapolla-analog/project.json`, `apps/bacteria-game-remote/project.json`.
   Replace `nx run {projectName}:firebase deploy[ --only …]` with `tsx --tsconfig tools/tsconfig.tools.json tools/deploy/retry-once.ts firebase --config=firebase.<app>.json --project=<app> deploy[ --only …] --non-interactive`.
   Check: `npx nx test tools-deploy` green; `npx nx show project <app> --json` shows the commands.
   Commit (with task 1): `fix(tools-deploy): retry a failed Hosting deploy once for every Hosting app`.

3. **Docs.** CLAUDE.md's Cloud Functions bullet on the helper names the Hosting deploys too. Commit: `docs(tools-deploy): every Firebase deploy runs through the one-retry helper`.

Before each commit: `npx nx format:write`, `npx nx affected -t lint,lint-templates`.
