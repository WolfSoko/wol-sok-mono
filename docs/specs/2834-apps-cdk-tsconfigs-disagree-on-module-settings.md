# Spec #2834: apps/\*-cdk tsconfigs disagree on module settings

Found while specifying [#2832](https://github.com/WolfSoko/wol-sok-mono/issues/2832)
(generator tsconfig templates). Related:
[#2412](https://github.com/WolfSoko/wol-sok-mono/issues/2412) (the CDK apps
share one ESNext target through `tsconfig.cdk.json`),
[#2824](https://github.com/WolfSoko/wol-sok-mono/issues/2824).

## Goal

The five hand-made CDK apps (`angular-examples-cdk`, `bacteria-game-remote-cdk`,
`fourier-analysis-remote-cdk`, `portfolio-cdk`, `shader-examples-remote-cdk`)
use one valid module setting, set once per app, and set their module
options and `types` as the `@wolsok/nx-aws-cdk-v2` application generator
writes them since #2832 (the apps keep their `tsconfig.spec.json` reference,
which the generator adds only with Jest).

Today:

- `tsconfig.json` sets `module: NodeNext` with `moduleResolution: bundler` in
  `angular-examples-cdk` and `bacteria-game-remote-cdk`, `NodeNext`/`NodeNext`
  in the other three.
- Every `tsconfig.app.json` overrides both with `node16`.
- `bacteria-game-remote-cdk/tsconfig.spec.json` sets `module: commonjs`.
- The invalid pair is live: `npx tsc -p apps/angular-examples-cdk/tsconfig.spec.json --noEmit`
  fails with TS5095 and TS5109 on `main` (the app has no specs yet, so Jest
  never compiled it).
- `fourier`, `portfolio` and `shader` list `jest` in the base `tsconfig.json`'s
  `types`, which the app config then overrides again.

## Non-goals

- No change to `libs/public/spa-cdk-stack` (published package, its own
  `ESNext`/`bundler` setting) or to the generator.
- No change to `tsconfig.cdk.json`'s target or to the CDK code.
- No new CI typecheck target for the CDK apps.

## Decisions

- **`NodeNext`/`NodeNext` in each app's `tsconfig.json`**, as the issue
  suggests and the generator writes. The apps run on Node (`tsx` from
  `cdk.json`); `NodeNext` checks them with Node's rules. The root
  `package.json` has no `"type": "module"`, so the `.ts` files stay CommonJS
  and the extensionless relative import in `bacteria-game-remote-cdk` keeps
  working.
  Rejected: moving the pair into `tsconfig.cdk.json`. One place would be less
  repetition, but a newly generated app sets the pair in its own
  `tsconfig.json` anyway, so the hand-made apps would then differ from the
  generated ones again.
- **No `module`/`moduleResolution` in `tsconfig.app.json` or
  `tsconfig.spec.json`**: they inherit from `tsconfig.json`; ts-jest compiles
  `NodeNext` with a CommonJS package to CommonJS, as `commonjs` did.
- **`types`**: `tsconfig.json` and `tsconfig.app.json` list `["node"]`,
  `tsconfig.spec.json` `["jest", "node"]`, as the generator writes.
- **`outDir` in every `tsconfig.json`**: `bacteria-game-remote-cdk` gains the
  `outDir` the other four apps and the generator already set.
- **Drop options the root already sets**: `esModuleInterop` (in
  `tsconfig.base.json`). `resolveJsonModule` in `bacteria-game-remote-cdk`
  goes too: no CDK app imports JSON (they read files with `readFileSync`).
- **Release type `chore`**: build configuration only, nothing deployed changes
  behaviour.

## Acceptance

1. No `apps/*-cdk/tsconfig*.json` sets `bundler`, `node16` or `commonjs`; each
   app's `tsconfig.json` sets `module` and `moduleResolution` to `NodeNext`,
   and neither `tsconfig.app.json` nor `tsconfig.spec.json` sets them.
2. `npx tsc -p apps/<app>/tsconfig.app.json --noEmit` and the same for
   `tsconfig.spec.json` pass for all five apps (TypeScript 6, the workspace's).
3. `npx nx run-many -t test,lint -p <the five apps>` passes, including
   `bacteria-game-remote-cdk`'s `firebase-domain.spec.ts`.
4. Every app still synthesises (condition of the approval): from the
   workspace root, `npx tsx --tsconfig apps/<app>/tsconfig.app.json apps/<app>/src/main.ts`
   with `RELEASE_VERSION` set and a scratch `CDK_OUTDIR` (synth only, no
   deploy) succeeds for all five apps, and its `cdk.out` equals `main`'s.

## Open questions

None.
