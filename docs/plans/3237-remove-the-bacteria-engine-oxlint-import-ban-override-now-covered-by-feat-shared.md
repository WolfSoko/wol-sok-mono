# Plan: remove the bacteria-engine oxlint import-ban override

Spec: [docs/specs/3237-remove-the-bacteria-engine-oxlint-import-ban-override-now-covered-by-feat-shared.md](../specs/3237-remove-the-bacteria-engine-oxlint-import-ban-override-now-covered-by-feat-shared.md)

1. **Test first.** Add `tools/ci/feat-shared-bans.test.mjs`: reads `.oxlintrc.json`, finds the `feat-shared` depConstraint, asserts its `bannedExternalImports` holds `@angular/*`, `@ngrx/*`, `rxjs`, `rxjs/*`, `firebase`, `firebase/*`, and that the tags of `feat-bacteria-rendering` and `feat-bacteria-sound` (read from their `project.json`) are not in its `onlyDependOnLibsWithTags`. Run `npx nx test tools`. Commit `test(tools): keep the feat-shared import bans`.
2. **Remove the override** from `.oxlintrc.json` and update CLAUDE.md's engine description. Run `npx nx lint feat-shared-bacteria-engine`, then the scratch-file check of the spec, `npx nx format:write`, `npx nx affected -t lint,lint-templates`. Commit `chore(feat-shared-bacteria-engine): drop the import-ban override covered by feat-shared`.
3. Spec and plan go in with the first commit (`docs(feat-shared-bacteria-engine): spec and plan for #3237`).
