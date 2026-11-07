# Spec #2835: nx-aws-cdk-v2: generated main.test.ts fails with aws-cdk-lib 2.274

Found while checking [#2832](https://github.com/WolfSoko/wol-sok-mono/issues/2832).
Related: [#2831](https://github.com/WolfSoko/wol-sok-mono/issues/2831) (plugin
e2e synth test fails on `main`, CI never runs the plugin e2e),
[#2824](https://github.com/WolfSoko/wol-sok-mono/issues/2824).

## Goal

The unit test the `application` generator of `@wolsok/nx-aws-cdk-v2` writes
with the Jest runner
(`libs/public/nx-aws-cdk-v2/src/generators/application/jest-files/src/main.test.ts__template__`)
passes out of the box and prints no validation warning.

Today it asserts `Template.fromStack(stack).templateMatches({ Resources: {} })`.
aws-cdk-lib synthesizes an empty stack without a `Resources` key (reproduced
on 2.271 and 2.274), so the test fails with _"Missing key 'Resources' at
/Resources"_. The same synthesis reports the CloudFormation-Validate warning
`F0001` (_"Resources section must exist and be non-empty"_), since an empty
`Resources` section is invalid CloudFormation.

## Non-goals

- No resource in the generated `AppStack`: a starter must not create
  infrastructure on the first `deploy`.
- The `synth` warning of a still-empty app stays: it is true, and it goes away
  with the first resource.
- The failing e2e synth test and running the plugin e2e in CI are
  [#2831](https://github.com/WolfSoko/wol-sok-mono/issues/2831).
- No change to `CDK_LIB_VERSION` (`^2.265.0`): everything the new test uses
  exists from 2.265 on (checked in the 2.265.0 package).

## Decisions

1. **Assert on the template's resources, not on a template shape.** The test
   reads `Resources` from `template.toJSON()` with `{}` as the default and
   expects it to equal `{}`. That holds whether aws-cdk-lib omits the key (now)
   or writes an empty one (older versions), and it still fails, as a starter
   test should, once the user adds a resource without updating the test.
   `resourceCountIs` needs a resource type, so it cannot say "no resources at
   all".
2. **Acknowledge F0001 in the test, not in the stack.**
   `Validations.of(stack).acknowledge({ id: 'CloudFormation-Validate::F0001', reason })`
   in the test keeps its output clean. Acknowledging it in `AppStack` would
   also silence `cdk synth`, which should keep telling the user the stack is
   still empty.
3. **Guard it with a spec that runs the generated test.** A Jest spec in the
   plugin generates an app into a virtual tree, transpiles the generated
   `main.test.ts` and `stacks/app-stack.ts` with TypeScript and runs the test
   bodies against the workspace's aws-cdk-lib. A template that only looks
   right is not enough here: the bug was in what aws-cdk-lib synthesizes.
4. **And an e2e test.** `nx-aws-cdk-v2-e2e` gets a test that runs `nx test` on
   a generated app, so the hand-run plugin e2e covers the whole consumer path
   (Jest config, tsconfig.spec, ts-jest) too.

## Acceptance

1. A freshly generated app's `nx test <app>` passes with aws-cdk-lib 2.274
   (plugin e2e test, run by hand).
2. Its output has no `CloudFormation-Validate::F0001` warning.
3. The plugin's unit spec runs the generated test against the workspace's
   aws-cdk-lib and fails with the old assertion (checked once by hand).
4. `nx test nx-aws-cdk-v2`, `nx lint nx-aws-cdk-v2` and `nx format:check` pass.

## Open questions

None.
