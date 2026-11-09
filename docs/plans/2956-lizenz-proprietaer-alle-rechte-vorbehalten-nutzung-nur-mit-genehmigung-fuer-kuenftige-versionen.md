# Plan 2956: Proprietary licence for RollaPolla and Korbjäger

Spec: `docs/specs/2956-lizenz-proprietaer-alle-rechte-vorbehalten-nutzung-nur-mit-genehmigung-fuer-kuenftige-versionen.md`

1. **Proprietary licence files.**
   - Files: `LICENSE` in `apps/rollapolla-analog`, `apps/korbjaeger`, `apps/korbjaeger-functions`, `apps/korbjaeger-cdk`, `libs/features/basketball-data`, `libs/features/korbjaeger-auswahl`, `tools/korbjaeger`; `"license": "UNLICENSED"` in the five `package.json` files of those projects.
   - Test: `cmp` over the copies; `nx test korbjaeger-functions` and `nx test korbjaeger` (`package-json.spec.ts`, `firebase-deploy.spec.ts`), `nx test rollapolla-analog`.
   - Commit: `chore(release): make RollaPolla and Korbjäger proprietary`.
2. **Root scope and docs.**
   - Files: `LICENSE` (scope paragraph above the MIT text), `README.md` (License section), `docs/CONTRIBUTING.md`, `CLAUDE.md`.
   - Test: `nx format:check`.
   - Same commit as task 1, so no release carries the files without the root's list.
3. PR to `main` with spec, plan and code, `Closes #2956`.
