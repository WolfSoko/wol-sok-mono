# Spec #2969: npm packages ship their own MIT LICENSE instead of the root LICENSE

Issue: [#2969](https://github.com/WolfSoko/wol-sok-mono/issues/2969). Found in
[#2956](https://github.com/WolfSoko/wol-sok-mono/issues/2956) /
[PR #2965](https://github.com/WolfSoko/wol-sok-mono/pull/2965).

## Goal

Every published package (`libs/public/*`, tag `published`) ships a `LICENSE`
holding the standard MIT text, and nothing else, in its npm tarball:

- `@wolsok/nx-aws-cdk-v2` today copies the root `LICENSE`, whose Scope
  paragraph lists the proprietary RollaPolla and Korbjäger folders the
  package does not contain. License scanners see non-standard MIT text.
- `@wolsok/thanos` and `@wolsok/spa-cdk-stack` ship no `LICENSE` at all, and
  `spa-cdk-stack`'s `package.json` has no `license` field.

## Non-goals

- No change to the root `LICENSE` or the proprietary ones.
- No change to the packages' code, targets, TypeScript settings or
  dependencies (published packages, held back for consumer compat).

## Decisions

- **One `LICENSE` per package, in its project root**, holding exactly the MIT
  part of the root `LICENSE` (from `MIT License` to the end): same copyright
  line, so the packages and the repository grant the same licence.
- **Build assets point at the package's own file**: `nx-aws-cdk-v2`'s
  `@nx/js:tsc` asset `{ input: ".", glob: "LICENSE" }` becomes
  `libs/public/nx-aws-cdk-v2/LICENSE`, `spa-cdk-stack` adds
  `libs/public/spa-cdk-stack/LICENSE`, `ws-thanos`' `ng-package.json` adds
  `"LICENSE"` to its `assets` (ng-packagr copies a project's `LICENSE` by
  default too; `@wolsok/thanos` shipped none only because the file was
  missing, and the explicit entry keeps the guard's rule the same for every
  package).
- **`"license": "MIT"`** in `spa-cdk-stack`'s `package.json`.
- **A guard against drift**: `tools/ci/published-licenses.test.mjs` (run by
  `npx nx test tools`) checks every project tagged `published`: a `LICENSE`
  in its root equal to the root `LICENSE`'s MIT part, `"license": "MIT"` in
  its `package.json`, and its build assets copying its own `LICENSE`, and no
  other, to the package root. So a new
  published package can't ship without one, and the root file can't leak in
  again. The `tools:test` inputs gain the `LICENSE` files, as they are no
  `*.json`.

## Acceptance

1. `libs/public/{nx-aws-cdk-v2,ws-thanos,spa-cdk-stack}/LICENSE` exist with
   the standard MIT text, without the Scope paragraph.
2. `npx nx build <pkg>` for each puts that `LICENSE` at the root of
   `dist/libs/public/<pkg>`, byte-equal to the source file.
3. `spa-cdk-stack`'s `package.json` (and its build output's) says
   `"license": "MIT"`.
4. `npx nx test tools` passes, and fails when a package's `LICENSE` is
   missing or differs, or the build asset points at the root `LICENSE`.
5. Lint and format pass.

## Open questions

None.
