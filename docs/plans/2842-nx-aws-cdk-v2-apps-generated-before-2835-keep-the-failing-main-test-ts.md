# Plan #2842: nx-aws-cdk-v2: apps generated before #2835 keep the failing main.test.ts

Spec: [docs/specs/2842-nx-aws-cdk-v2-apps-generated-before-2835-keep-the-failing-main-test-ts.md](../specs/2842-nx-aws-cdk-v2-apps-generated-before-2835-keep-the-failing-main-test-ts.md)

One PR. Commits:

1. **Move the generated-test loader into a test helper** (`refactor(nx-aws-cdk-v2): ...`).
   `loadFromTree`, `collectGeneratedTests` and `runNamed` from
   `src/generators/application/generated-test.spec.ts` go into
   `src/testing/generated-test.ts` (excluded from `tsconfig.lib.json`,
   included in `tsconfig.spec.json`), with a `runGeneratedTests` that also
   collects console output. The spec uses it; it stays green.
2. **Migration, test first** (`feat(nx-aws-cdk-v2): ...`).
   - Red spec `src/migrations/update-4-2-0/update-starter-test.spec.ts`:
     generate an app, overwrite `src/main.test.ts` with each old starter shape
     (legacy, current, current reformatted with double quotes and no
     semicolons), run the migration, expect the rewrite with the old stack id
     and describe name and run it with the helper (passes, no F0001); an edited
     test stays byte for byte and is warned about when it still holds the
     failing assertion; a project without the file and an empty workspace pass.
   - `src/migrations/update-4-2-0/update-starter-test.ts`: normalise, match the
     two shapes by regex, render the new test, `formatFiles`.
   - `migrations.json`: `update-starter-test` at `4.2.0` with description and
     `implementation`; a spec that the implementation path exists and exports a
     default function.
   - README: "Upgrading" section (and its table-of-contents entry).
3. **Checks.** `nx test nx-aws-cdk-v2`, `nx build nx-aws-cdk-v2` (check the
   migration and `migrations.json` land in `dist`), `nx lint nx-aws-cdk-v2`,
   `nx affected -t lint,lint-templates`, `nx format:write`.
