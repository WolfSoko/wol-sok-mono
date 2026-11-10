# Plan #2882: tools: drop the direct version.json reads in version-handling and deploy-android

Spec: [docs/specs/2882-tools-drop-the-direct-version-json-reads-in-version-handling-and-deploy-android.md](../specs/2882-tools-drop-the-direct-version-json-reads-in-version-handling-and-deploy-android.md)

`tools/` has no test runner for these scripts; each task is checked by
running the scripts before and after and by `tsc --noEmit`.

1. **Docs.** Spec and plan. Commit: `docs(tools): spec and plan for #2882`.
2. **latest-version-tag.** Record the output of the three version-handling
   scripts first. `tools/version-handling/latest-version-tag.ts`: drop the
   `version.json` import and the `!appDeployedPrefix` branch, export
   `DeployPrefix`, type the parameter as `DeployPrefix`.
   `write-version-tag.ts`: import the type instead of declaring it. Test:
   the scripts print the same tags; `tsc --noEmit` on the files. Commit:
   `refactor(tools): drop the dead version.json read in latestVersionTag`.
3. **deploy-android.** `tools/bacteria-game/deploy-android.ts`: take the
   version from `WORKSPACE_VERSION` of `@wolsok/utils-version`;
   `apps/bacteria-wars-android/project.json`: `deploy` runs
   `tsx --tsconfig tools/tsconfig.tools.json …`; drop `rootDir` from that
   config and the `.ts` import extension in `latest-cdk-deployed-tag.ts`. Test: the script loads and
   stops at the first missing secret (`RELEASE_VERSION`); `tsc --noEmit`.
   Commit: `refactor(tools): read the Android deploy's version through utils-version`.
4. **Checks.** `npx nx format:write`, `npx nx affected -t lint,lint-templates,test`,
   then the PR.
