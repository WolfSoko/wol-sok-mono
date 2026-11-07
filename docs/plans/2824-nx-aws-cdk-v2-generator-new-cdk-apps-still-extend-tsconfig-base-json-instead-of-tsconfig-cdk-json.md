# Plan #2824: nx-aws-cdk-v2 generator extends tsconfig.cdk.json where the workspace has one

Spec: [docs/specs/2824-…](../specs/2824-nx-aws-cdk-v2-generator-new-cdk-apps-still-extend-tsconfig-base-json-instead-of-tsconfig-cdk-json.md)

## Task 1: failing specs

- File: `libs/public/nx-aws-cdk-v2/src/generators/application/application.spec.ts`
- Add: without `tsconfig.cdk.json` the generated `tsconfig.json` extends
  `../../tsconfig.base.json`; with a root `tsconfig.cdk.json` it extends
  `../../tsconfig.cdk.json`; with `--directory=sub` `../../../tsconfig.cdk.json`.
- Run `npx nx test nx-aws-cdk-v2`: the two `tsconfig.cdk.json` cases fail.

## Task 2: detect the base tsconfig

- Files: `application.ts`, `files/tsconfig.json__template__`
- `application.ts`: a small named function `baseTsconfig(host)` returning
  `tsconfig.cdk.json` when `host.exists('tsconfig.cdk.json')`, else
  `tsconfig.base.json` (names as constants), passed to the template as
  `baseTsconfig`; the duplicated template-options building of `addFiles` and
  `addJestFiles` goes into one `templateOptions(host, options)` helper.
- Template: `"extends": "<%= offsetFromRoot %><%= baseTsconfig %>"`.
- Run `npx nx test nx-aws-cdk-v2`: green.

## Task 3: README

- File: `libs/public/nx-aws-cdk-v2/README.md`, section "What gets generated":
  one paragraph on `tsconfig.json` extending `tsconfig.cdk.json` when the
  workspace root has one (for a Node-only target of CDK apps), else
  `tsconfig.base.json`.

## Task 4: checks and commit

- `npx nx format:write`, `npx nx affected -t lint,lint-templates,test,build`,
  `npx nx e2e nx-aws-cdk-v2-e2e` by hand.
- One commit `feat(nx-aws-cdk-v2): extend tsconfig.cdk.json in generated apps where the workspace has one`,
  with spec and plan; PR to `main` with `Closes #2824`.
