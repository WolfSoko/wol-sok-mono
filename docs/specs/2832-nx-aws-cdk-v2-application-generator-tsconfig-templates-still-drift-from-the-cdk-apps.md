# Spec #2832: nx-aws-cdk-v2 application generator: tsconfig templates still drift from the CDK apps

Follow-up of [#2824](https://github.com/WolfSoko/wol-sok-mono/issues/2824)
([PR #2829](https://github.com/WolfSoko/wol-sok-mono/pull/2829)), found in its
review. Related: [#2831](https://github.com/WolfSoko/wol-sok-mono/issues/2831)
(plugin e2e synth test fails on `main`).

## Goal

The tsconfig files the `application` generator of `@wolsok/nx-aws-cdk-v2`
(`libs/public/nx-aws-cdk-v2/src/generators/application`) writes are valid in
every workspace the plugin supports and match the workspace's own
`apps/*-cdk`:

1. **Module settings.** `files/tsconfig.json__template__` hard-codes
   `"module": "commonjs"` and inherits `moduleResolution` from the root. A
   root with `moduleResolution: bundler` (this workspace, and new Nx
   workspaces) makes TypeScript 5.x fail with TS5095 (_"Option 'bundler' can
   only be used when 'module' is set to 'preserve' or to 'es2015' or later"_;
   reproduced with TypeScript 5.9.3 against this workspace's
   `tsconfig.cdk.json`; TypeScript 6 accepts the pair, so the workspace itself
   never saw it), and type-aware oxlint reports `tsconfig-error`. The
   generated `tsconfig.json` sets `"module": "NodeNext"` and
   `"moduleResolution": "NodeNext"` itself, as `apps/portfolio-cdk` does.
2. **Types.** The same template writes `"types": ["node", "jest"]` even with
   `--unitTestRunner=none`, where `@types/jest` may not be installed (TS2688).
   The generated `tsconfig.json` lists `["node"]` only; the Jest types stay in
   the `tsconfig.spec.json` `@nx/jest` writes (`["jest", "node"]`).
3. **TS-solution workspaces.** There `@nx/jest`'s `configurationGenerator`
   writes `tsconfig.spec.json` extending `<offset>tsconfig.base.json` directly
   (`extendedConfig` in its `create-files.js`), so the specs bypass a root
   `tsconfig.cdk.json`. When the app extends `tsconfig.cdk.json`, the
   generator points that `extends` at `<offset>tsconfig.cdk.json` as well.

## Non-goals

- No change to the hand-made `apps/*-cdk` tsconfigs. They differ among
  themselves (`tsconfig.json`: `NodeNext` with `bundler` in three of them;
  `tsconfig.app.json`: `node16`); aligning them is a follow-up of its own,
  raised to the manager.
- No `.js` extensions in the generated `src/main.ts` imports (see open
  question), no generated `package.json`.
- No fix of the plugin e2e synth test (#2831).
- No change to the plugin's own compile target (`libs/public/*` policy).

## Decisions

- **`NodeNext`/`NodeNext`, not `preserve`/`bundler`.** The app runs on Node
  (`tsx` in the executors and `cdk.json`); `NodeNext` checks it with Node's
  rules and is what `apps/portfolio-cdk` uses. Setting both options in the
  app's own `tsconfig.json` makes it independent of whatever the root holds.
  `tsconfig.spec.json` keeps the `module`/`moduleResolution` `@nx/jest`
  writes for ts-jest, which override these.
- **Rewrite only the exact path `@nx/jest` writes.** Item 3 changes
  `tsconfig.spec.json`'s `extends` only when it is
  `<offset>tsconfig.base.json` and the app extends `tsconfig.cdk.json`; any
  other value (`./tsconfig.json` in non-TS-solution workspaces, a future
  `@nx/jest` choice) is left alone. A small named function next to
  `baseTsconfig()` does it after `configurationGenerator` ran.
- **Release type `fix`**: generated configs that fail to compile are a bug of
  the published package; no new option.

## Acceptance

1. The generated `<root>/tsconfig.json` sets `"module": "NodeNext"` and
   `"moduleResolution": "NodeNext"` and no `commonjs` (unit spec).
2. With `--unitTestRunner=none` no generated tsconfig lists `jest` in
   `types`; with Jest, `tsconfig.json` and `tsconfig.app.json` list
   `["node"]` and `tsconfig.spec.json` lists `jest` (unit spec).
3. In a TS-solution workspace with a root `tsconfig.cdk.json`, the generated
   `tsconfig.spec.json` extends `../../tsconfig.cdk.json`; without
   `tsconfig.cdk.json` it keeps `../../tsconfig.base.json`; in a
   non-TS-solution workspace it keeps `./tsconfig.json` (unit specs).
4. Generated into this workspace, the app's `tsconfig.app.json` type-checks
   with `tsc --noEmit` under TypeScript 5.9 and 6.0 (manual check, noted in
   the PR).
5. The README's "What gets generated" says the app sets its own module
   settings.
6. `nx test`, `nx lint` and `nx build` of `nx-aws-cdk-v2` pass; the plugin
   e2e is run by hand and compared against `main` (its synth test fails
   there too, #2831).

## Open questions

- A consumer whose root `package.json` has `"type": "module"` makes
  `src/main.ts` an ES module under `NodeNext`, and its extensionless
  `./stacks/app-stack` import fails with TS2835 (`tsx` itself still runs it).
  Today such a consumer gets TS5095 instead, so nothing gets worse; writing
  `.js` extensions would need Jest's resolver mapped too. Recommendation:
  leave it and note it in the README, unless the manager wants it in scope.
