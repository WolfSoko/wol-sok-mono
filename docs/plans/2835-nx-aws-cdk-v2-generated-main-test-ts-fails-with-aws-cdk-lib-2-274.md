# Plan #2835: nx-aws-cdk-v2: generated main.test.ts fails with aws-cdk-lib 2.274

Spec: [docs/specs/2835-nx-aws-cdk-v2-generated-main-test-ts-fails-with-aws-cdk-lib-2-274.md](../specs/2835-nx-aws-cdk-v2-generated-main-test-ts-fails-with-aws-cdk-lib-2-274.md)

One PR, one commit (`fix(nx-aws-cdk-v2): ...`), since the tasks only make
sense together.

1. **Red spec.** `libs/public/nx-aws-cdk-v2/src/generators/application/generated-test.spec.ts`:
   generate an app into `createTreeWithEmptyWorkspace()`, transpile
   `apps/<app>/src/main.test.ts` and `src/stacks/app-stack.ts` with
   `ts.transpileModule` (CommonJS), evaluate them with a `require` that maps
   `./stacks/app-stack` to the transpiled stack and with `describe`/`it`
   collectors, and run every collected body. Expect them to pass and to log
   no `F0001`. Red against the current template.
2. **Fix the template.** `jest-files/src/main.test.ts__template__`: read
   `Resources` from `toJSON()` with `{}` as default, expect `{}`; acknowledge
   `CloudFormation-Validate::F0001` on the stack with a reason. Spec green.
3. **E2E test.** `apps/nx-aws-cdk-v2-e2e/tests/aws-cdk.spec.ts`: generate an
   app and run `nx test <app>`; expect success and no `F0001` in the output.
   Run `npx nx e2e nx-aws-cdk-v2-e2e` by hand (the known synth failure of
   [#2831](https://github.com/WolfSoko/wol-sok-mono/issues/2831) aside).
4. **Checks.** `nx test nx-aws-cdk-v2`, `nx lint nx-aws-cdk-v2`,
   `nx affected -t lint,lint-templates`, `nx format:write` with the pinned
   oxfmt.
