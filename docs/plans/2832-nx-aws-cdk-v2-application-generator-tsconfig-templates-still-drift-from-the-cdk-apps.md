# Plan #2832: nx-aws-cdk-v2 application generator: tsconfig templates still drift from the CDK apps

Spec: [docs/specs/2832-…](../specs/2832-nx-aws-cdk-v2-application-generator-tsconfig-templates-still-drift-from-the-cdk-apps.md)

## Task 1: failing specs

- File: `libs/public/nx-aws-cdk-v2/src/generators/application/application.spec.ts`
- Add: module settings (`NodeNext`/`NodeNext`); `types` without `jest` for
  `--unitTestRunner=none` and with Jest only in `tsconfig.spec.json`; a
  TS-solution tree (`workspaces` in `package.json`, `composite` base,
  solution `tsconfig.json`) where `tsconfig.spec.json` extends
  `../../tsconfig.cdk.json` with that file and `../../tsconfig.base.json`
  without; the non-TS-solution case keeps `./tsconfig.json`.
- Run `npx nx test nx-aws-cdk-v2`: the new module, types and TS-solution
  cdk cases fail.

## Task 2: templates

- File: `files/tsconfig.json__template__`: `module`/`moduleResolution`
  `NodeNext`, `types` `["node"]`.

## Task 3: spec tsconfig in TS-solution workspaces

- File: `application.ts`: `pointSpecTsconfigAtBase(host, options)` after
  `configurationGenerator`, rewriting `extends` from
  `<offset>tsconfig.base.json` to `<offset><baseTsconfig>` with `updateJson`.
- Run `npx nx test nx-aws-cdk-v2`: green.

## Task 4: README

- File: `libs/public/nx-aws-cdk-v2/README.md`, "What gets generated": the app's
  own `NodeNext` module settings, Jest types only in `tsconfig.spec.json`,
  and the `"type": "module"` note (open question).

## Task 5: checks and commit

- Manual: generate an app into this workspace (`npx nx g` of the built
  plugin, or the generator through a tree script), run `tsc --noEmit` on its
  `tsconfig.app.json` with TypeScript 5.9 and 6.0, then delete it.
- `npx nx format:write`, `npx nx affected -t lint,lint-templates,test,build`,
  `npx nx e2e nx-aws-cdk-v2-e2e` by hand (compare against `main`, #2831).
- One commit `fix(nx-aws-cdk-v2): keep generated tsconfigs valid and in line with the CDK apps`
  with spec and plan; PR to `main` with `Closes #2832`.
