# Plan 2956: Proprietary licence for future versions

Spec: `docs/specs/2956-lizenz-proprietaer-alle-rechte-vorbehalten-nutzung-nur-mit-genehmigung-fuer-kuenftige-versionen.md`

1. **Packages keep MIT on their own** (before the root changes, so no release ships without a licence).
   - Files: `libs/public/{ws-thanos,nx-aws-cdk-v2,spa-cdk-stack}/LICENSE` (current MIT text), `libs/public/nx-aws-cdk-v2/project.json` (asset `LICENSE` from the package folder), `libs/public/ws-thanos/ng-package.json` (assets add `LICENSE`), `libs/public/spa-cdk-stack/project.json` (assets add `LICENSE`), `libs/public/spa-cdk-stack/package.json` (`"license": "MIT"`).
   - Test: `nx build` each package, `LICENSE` with "MIT License" in each `dist/libs/public/*`.
   - Commit: `chore(nx-aws-cdk-v2): ship the packages' own MIT licence` (scopes per touched project; one commit each if commitlint wants one scope).
2. **Root licence proprietary.**
   - Files: `LICENSE`, `package.json` (`UNLICENSED`), `README.md` (License section), `docs/CONTRIBUTING.md`.
   - Test: `nx format:check`; read the texts.
   - Commit: `chore(release): make the repository proprietary for future versions`.
3. **Portfolio texts.**
   - Files: `apps/portfolio/src/app/i18n/texts.en.ts`, `texts.de.ts`.
   - Test: `nx test portfolio`.
   - Commit: `fix(portfolio): stop calling the monorepo open source`.
4. Spec and plan go in the first commit (`docs`), PR to `main` with `Closes #2956`.
