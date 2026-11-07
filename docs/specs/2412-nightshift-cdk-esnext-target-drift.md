# Spec #2412: CDK apps share one ESNext target

Issue: [#2412](https://github.com/WolfSoko/wol-sok-mono/issues/2412)
(nightshift finding `cdk-esnext-target-drift`).

## Goal

Every `apps/*-cdk` project compiles with `target: "ESNext"`, as the Target
Policy in `CLAUDE.md` says, and cannot drift from it again by a copy that
forgets the line.

[#2414](https://github.com/WolfSoko/wol-sok-mono/pull/2414) fixed
`fourier-analysis-remote-cdk` and `shader-examples-remote-cdk`; the nightwatch
run of 2026-11-07 found the same gap in `portfolio-cdk`, which still inherits
`ES2023` from `tsconfig.base.json` (`tsc --showConfig` on its
`tsconfig.app.json` resolves `"target": "es2023"`). Five apps each carry the
override on their own, so each new CDK app has to remember it.

## Non-goals

- No change to `module`/`moduleResolution` of the CDK apps: they differ
  between apps (`bundler` vs `NodeNext`) and `tsconfig.app.json` overrides
  both with `node16` anyway. Unifying them is a separate topic.
- No change to `lib` (still `dom`, `ES2024` from the base).
- No change to `libs/public/*` (published, held back by policy), including
  the `@wolsok/nx-aws-cdk-v2` generator templates.
- No change to the stacks' code.

## Decisions

- **One shared `tsconfig.cdk.json` at the workspace root** extends
  `tsconfig.base.json` and sets only `target: "ESNext"`. Each of the five
  `apps/*-cdk/tsconfig.json` extends it instead of `tsconfig.base.json` and
  drops its own `target`. The policy then lives in one file; a future
  browser-target bump in `tsconfig.base.json` cannot reach the CDK apps. A
  root file sits next to `tsconfig.base.json`, where type-aware oxlint
  (TypeScript 7 semantics) resolves `extends` chains as usual.
- **This PR supersedes the nightshift draft
  [#2818](https://github.com/WolfSoko/wol-sok-mono/pull/2818)**, which adds
  the line to `portfolio-cdk` alone: the shared file fixes that app and the
  cause. #2818 should be closed unmerged once this one merges.
- **No guard spec.** With the target in one shared file, drift needs a new
  CDK app that extends the base directly; the `CLAUDE.md` Target Policy line
  names the shared file for that case. A workspace-wide spec over all
  `*-cdk` tsconfigs would need a home project none of them is.
- **Commit type `fix(portfolio-cdk)`**: the visible defect is that app's
  wrong target; the others only change how they get the same value.

## Acceptance

1. `npx tsc -p apps/<app>/tsconfig.app.json --showConfig` resolves
   `"target": "esnext"` for all five `*-cdk` apps (`angular-examples-cdk`,
   `bacteria-game-remote-cdk`, `fourier-analysis-remote-cdk`,
   `portfolio-cdk`, `shader-examples-remote-cdk`), and the same for their
   `tsconfig.spec.json`.
2. No `apps/*-cdk/tsconfig*.json` sets `target` itself.
3. `npx tsc -p apps/<app>/tsconfig.app.json --noEmit` reports no more errors
   than on `main` for each of the five apps.
4. `npx nx run-many -t test,lint -p <the five apps>` passes.
5. `CLAUDE.md`'s Target Policy names `tsconfig.cdk.json`.

## Open questions

None.
