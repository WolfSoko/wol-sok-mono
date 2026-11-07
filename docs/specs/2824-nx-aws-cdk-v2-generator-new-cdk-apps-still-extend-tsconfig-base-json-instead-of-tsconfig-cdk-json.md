# Spec #2824: nx-aws-cdk-v2 generator extends tsconfig.cdk.json where the workspace has one

Follow-up of [#2412](https://github.com/WolfSoko/wol-sok-mono/issues/2412)
(CDK apps share one ESNext target), found while reviewing
[PR #2819](https://github.com/WolfSoko/wol-sok-mono/pull/2819).

## Goal

The `application` generator of `@wolsok/nx-aws-cdk-v2`
(`libs/public/nx-aws-cdk-v2/src/generators/application`) writes a
`tsconfig.json` that extends `<offset>tsconfig.base.json`. In this workspace
every CDK app extends the root `tsconfig.cdk.json` instead (Target Policy in
`CLAUDE.md`: `target: "ESNext"`, Node runtime), so the next generated app
would compile at the browser target again and bring back the drift #2412
removed.

The generator extends `<offset>tsconfig.cdk.json` when the workspace root has
that file, and `<offset>tsconfig.base.json` otherwise.

## Non-goals

- No new `tsconfig.cdk.json` in consumer workspaces: the generator does not
  create one, and a workspace without it gets exactly what it gets today.
- No change to the plugin's own compile target (`libs/public/*` targets are
  held back by policy).
- No guard spec over `apps/*-cdk/tsconfig.json` for hand-made apps: all five
  CDK apps already extend `tsconfig.cdk.json`, and `CLAUDE.md` states the
  rule; the generator was the one path that wrote it wrong.

## Decisions

- **Detect the file instead of adding an option.** A generator option (say
  `--baseTsconfig`) would need every caller in this workspace to remember it,
  so the default would still be wrong here. Detecting `tsconfig.cdk.json` in
  the tree makes the right choice without a flag and leaves published
  consumers, who have no such file, unchanged. The name `tsconfig.cdk.json`
  is documented in the README as the convention the generator follows.
- **Root only.** The file is looked up at the workspace root, next to
  `tsconfig.base.json`, which is where the template's `offsetFromRoot`
  points.
- **Release type `feat`**: a consumer-visible new behaviour of a published
  package (minor bump through the workspace's release), backwards compatible.

## Acceptance

1. In a workspace without `tsconfig.cdk.json`, the generated
   `<root>/tsconfig.json` extends `../../tsconfig.base.json` (unit spec).
2. In a workspace with a root `tsconfig.cdk.json`, it extends
   `../../tsconfig.cdk.json` (unit spec), also with `--directory`
   (`../../../tsconfig.cdk.json`).
3. The README's generator section says which file is extended and when.
4. `nx test nx-aws-cdk-v2`, `nx lint nx-aws-cdk-v2` and `nx build nx-aws-cdk-v2`
   pass; the plugin e2e (`nx e2e nx-aws-cdk-v2-e2e`, run by hand as
   `CLAUDE.md` asks after a plugin change) passes where the container allows it.

## Open questions

None.
