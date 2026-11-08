# Plan #2847: Remove the unused IDistribution import and make no-unused-vars an error workspace-wide

Spec: [docs/specs/2847-…](../specs/2847-remove-the-unused-idistribution-import-and-make-no-unused-vars-an-error-workspace-wide.md)

## Task 1: show the failure first

- Files: `.oxlintrc.json`.
- Set `no-unused-vars` to `error` at the root; `npx nx lint spa-cdk-stack`
  fails on `IDistribution`.

## Task 2: remove the import and the override

- Files: `libs/public/spa-cdk-stack/src/lib/spa/spa.construct.ts`,
  `.oxlintrc.json`.
- Remove the `IDistribution` import; remove the game lib's
  `no-unused-vars` override.
- `npx nx lint spa-cdk-stack` passes; `npx nx run-many -t lint` passes for
  all projects; `npx nx run-many -t build,test -p spa-cdk-stack` pass.
- Check acceptance 4 by hand with a throwaway unused import in another
  project, then revert it.

## Task 3: commit and PR

- `npx nx format:write`, `npx nx affected -t lint,lint-templates`.
- One commit `chore(nx): make no-unused-vars an error workspace-wide` with
  spec and plan. PR to `main` with `Closes #2847`.
