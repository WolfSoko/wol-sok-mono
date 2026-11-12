# Plan #2969: npm packages ship their own MIT LICENSE

Spec: [docs/specs/2969-npm-packages-ship-their-own-mit-license-instead-of-the-root-license.md](../specs/2969-npm-packages-ship-their-own-mit-license-instead-of-the-root-license.md).

1. **Guard first** — `tools/ci/published-licenses.test.mjs`: for every
   `project.json` tagged `published`, assert its root `LICENSE` equals the
   MIT part of the root `LICENSE`, its `package.json` says `"license": "MIT"`
   and its build assets (`@nx/js:tsc` `assets`, or `ng-package.json`
   `assets` for ng-packagr) name `<root>/LICENSE`. Add the `LICENSE` files to
   `tools:test`'s inputs (`tools/project.json`). Run `npx nx test tools`: red
   for all three packages.
   Commit: `test(tools): check that published packages ship their own MIT LICENSE`.
2. **Licences** — add the three `LICENSE` files, point the build assets at
   them (`libs/public/nx-aws-cdk-v2/project.json`,
   `libs/public/spa-cdk-stack/project.json`,
   `libs/public/ws-thanos/ng-package.json`), add `"license": "MIT"` to
   `libs/public/spa-cdk-stack/package.json`. `npx nx test tools` green; build
   each package and diff its `dist/.../LICENSE` against the source.
   One commit per package: `fix(nx-aws-cdk-v2): ship its own MIT LICENSE`,
   `fix(ws-thanos): ship an MIT LICENSE`, `fix(spa-cdk-stack): ship an MIT
   LICENSE and declare it in package.json`.
3. **Checks** — `npx nx format:write`, `npx nx affected -t lint,lint-templates,test`,
   then PR with `Closes #2969`.
