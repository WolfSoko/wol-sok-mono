# @wolsok/spa-cdk-stack: load in Node and under NodeNext

Issue: [#3100](https://github.com/WolfSoko/wol-sok-mono/issues/3100)

## Goal

The published `@wolsok/spa-cdk-stack` loads outside the monorepo: through `require` and `import` in Node, and its types resolve for a consumer typechecked with `"module": "NodeNext", "moduleResolution": "NodeNext"` (what `@wolsok/nx-aws-cdk-v2` generates for CDK apps).

Today `@nx/js:tsc` builds it with the workspace's `"module": "ESNext", "moduleResolution": "bundler"`, so it writes `"type": "module"` into the published `package.json`, while `tsc` keeps the extensionless relative specifiers (`'./lib/spa/spa.stack'`) in `.js` and `.d.ts`. Node refuses them (`ERR_MODULE_NOT_FOUND`), and TypeScript under NodeNext finds no exports (`TS2305`).

## Non-goals

- No change to the stack's or construct's behaviour or API.
- No `exports` map or dual CJS/ESM build.
- No `target` change (`libs/public/*` targets stay as they are, CLAUDE.md's target policy).
- No change to `@wolsok/nx-aws-cdk-v2`, which already builds with `node16`.

## Decisions

- **Build as CommonJS with `node16`**, as `nx-aws-cdk-v2` does: `tsconfig.lib.json` sets `"module": "node16", "moduleResolution": "node16"`. The source `package.json` has no `"type"`, so `tsc` emits CommonJS and `@nx/js:tsc` writes `"type": "commonjs"`. Reason: `aws-cdk-lib` itself is CommonJS and most CDK apps run as CommonJS (`ts-node`, `node`), so `require` works on every Node the consumer runs, and `import` works through Node's CommonJS named-export detection (checked: `import { SpaStack, envOrDie } from '@wolsok/spa-cdk-stack'`). Adding `.js` to the specifiers and keeping ESM would leave `require` only to Node versions with `require(esm)`, and the next extensionless import would break it again unnoticed, since `bundler` resolution accepts it.
- **Only the build tsconfig changes**: `tsconfig.json` (lint, spec) keeps `bundler`, as in `nx-aws-cdk-v2`; the workspace's own CDK apps import the sources through `paths` and are unaffected.
- **Guard by a spec in the lib**: `src/package-format.spec.ts` parses `tsconfig.lib.json` with TypeScript and fails unless `module` and `moduleResolution` are `Node16` or `NodeNext`. Under those, `tsc` itself refuses an ESM output with extensionless relative imports, so the published files resolve the way Node resolves them, whatever the package's `type`. The spec runs with the lib's `test`, which CI runs whenever the lib is affected.
- **Release**: a `fix(spa-cdk-stack)` commit, so the next release publishes a patch version.

## Acceptance

1. `nx build spa-cdk-stack` writes `"type": "commonjs"` and CommonJS `.js` files.
2. A fresh consumer outside the workspace that installs the packed build can `require('@wolsok/spa-cdk-stack')` and `import { SpaStack, envOrDie } from '@wolsok/spa-cdk-stack'` in Node.
3. In that consumer, `tsc --module NodeNext --moduleResolution NodeNext --noEmit` passes for an `.mts` and a `.cts` file importing `SpaStack`, `SpaConstruct` and `envOrDie`, without `--skipLibCheck`.
4. `src/package-format.spec.ts` fails when `tsconfig.lib.json` goes back to `ESNext`/`bundler`.
5. `nx test spa-cdk-stack`, `nx lint spa-cdk-stack` and the CDK apps' builds/synths in CI stay green.

## Open questions

None.
