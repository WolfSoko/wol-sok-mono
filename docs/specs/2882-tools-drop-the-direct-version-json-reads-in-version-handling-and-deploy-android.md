# Spec #2882: tools: drop the direct version.json reads in version-handling and deploy-android

Found while building [#2846](https://github.com/WolfSoko/wol-sok-mono/issues/2846).

## Goal

No script under `tools/` reads the root `version.json` itself any more.
CLAUDE.md says the workspace version is read only through
`@wolsok/utils-version` (`libs/utils/version`), and two scripts outside any
Nx project still bypass it, out of reach of the `wolsok/no-version-json-read`
lint rule:

1. `tools/version-handling/latest-version-tag.ts` imports
   `'../../version.json'` only for `if (!appDeployedPrefix) return version;`.
   Every caller passes a non-empty literal (`latest-cdk-deployed-tag.ts`,
   `latest-non-cdk-deployed-tag.ts`, and `write-version-tag.ts` through
   `parsePrefix`), so the branch is dead.
2. `tools/bacteria-game/deploy-android.ts` reads it with
   `readJson('version.json')` for the Play version code.

## Non-goals

- No lint coverage for `tools/` scripts (they belong to no Nx project, so
  `nx lint` does not reach them); raised separately if wanted.
- No change to what the scripts compute: the version tag and the version
  code stay the same.
- `apps/bacteria-wars-android/app/build.gradle.kts` reads `version.json` in
  Gradle; that is not TypeScript and stays as it is.

## Decisions

- **Drop the dead branch and the import** in `latest-version-tag.ts`, and type
  the parameter as the deploy-prefix union. The union moves into
  `latest-version-tag.ts` (`DEPLOY_PREFIXES`, `DeployPrefix` derived from it), and
  `write-version-tag.ts` imports it instead of declaring its own copy, so the
  type the function takes and the values the CLI accepts are defined once.
- **`deploy-android.ts` imports `WORKSPACE_VERSION` from
  `@wolsok/utils-version`.** `tsx` resolves tsconfig `paths` but reads only
  `tsconfig.json` in the working directory, which the workspace root does not
  have. The `bacteria-wars-android:deploy` command passes
  `--tsconfig tools/tsconfig.tools.json` (it extends `tsconfig.base.json`, so
  the `@wolsok/*` paths come with it); checked locally: the alias resolves
  and prints the workspace version. No root `tsconfig.json` is added: it
  would change what every other tool picks up.
- **`tools/tsconfig.tools.json` loses its `rootDir: "."` and `outDir` for
  `noEmit: true`**: nothing emits from it, and the import of `libs/utils/version` would fail it (TS6059).
  While touching the folder, `latest-cdk-deployed-tag.ts` drops the `.ts`
  extension in its import, the one other error the config reported (TS5097),
  so `tsc -p tools/tsconfig.tools.json --noEmit` is clean.
- Only the `deploy` target gets the flag; the other `tsx` targets of the app
  import no `@wolsok/*` path.

## Acceptance

1. `tools/version-handling/latest-version-tag.ts` imports no `version.json`,
   and `latestVersionTag` takes `DeployPrefix` (`'cdk-deployed' |
   'non-cdk-deployed'`); `write-version-tag.ts` uses that same type.
2. `tsx tools/version-handling/latest-cdk-deployed-tag.ts`,
   `latest-non-cdk-deployed-tag.ts` and `write-version-tag.ts` print the
   same tags as before the change.
3. `tools/bacteria-game/deploy-android.ts` no longer reads `version.json`;
   it takes the version from `WORKSPACE_VERSION`.
4. The `bacteria-wars-android:deploy` command runs `tsx` with
   `--tsconfig tools/tsconfig.tools.json`, and the script loads with it (its
   imports resolve; it stops at the first missing secret, as without the
   change).
5. `grep -rn "version.json" tools --include=*.ts` finds no read of the file
   (comments aside).
6. The touched files typecheck (`tsc --noEmit` against
   `tools/tsconfig.tools.json`), format and affected lint are green.

## Open questions

None.
