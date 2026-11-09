# Plan #2915: Playwright configs only wait for Nx-started web servers inside an Nx task

Spec: [docs/specs/2915-playwright-configs-only-wait-for-nx-started-web-servers-inside-an-nx-task-shared-helper-for-all-apps.md](../specs/2915-playwright-configs-only-wait-for-nx-started-web-servers-inside-an-nx-task-shared-helper-for-all-apps.md)

1. **Shared lib.** `libs/shared/e2e-server/`: `project.json` (tag `shared`,
   Jest `test`), `package.json`, tsconfigs, `jest.config.ts` (node
   environment), `README.md`, `src/index.ts`, `src/lib/nx-server.ts`,
   `src/wait-for-server.mjs`; path alias `@wolsok/shared-e2e-server` in
   `tsconfig.base.json`. Test first: `src/lib/nx-server.spec.ts` (the
   Korbjäger spec, ported, plus a check that the command's script path exists).
   Commit: `feat(shared-e2e-server): add the Nx-aware Playwright web server
   helper`.
2. **Korbjäger on the lib.** `apps/korbjaeger/playwright.config.ts` imports
   `nxServer` from the lib; delete `apps/korbjaeger/e2e/server/` and
   `apps/korbjaeger/src/e2e-server.spec.ts`. Test: lib spec, `nx show project
   korbjaeger` still lists the server dependencies. Commit:
   `refactor(korbjaeger): take the e2e web servers from shared-e2e-server`.
3. **The other apps.** `bacteria-game-remote`, `rollapolla-analog`,
   `pacetrainer`, `fourier-analysis-remote`, `ws-thanos-test-app`: each
   `webServer` entry through `nxServer`, same targets, URLs and timeouts.
   Test: `nx show project <app>` dependencies unchanged; one e2e run through
   Nx. Commit: `fix(nx): only wait for Nx-started web servers in every
   app's e2e`.
4. **Docs.** CLAUDE.md, Testing: name `@wolsok/shared-e2e-server` instead of
   Korbjäger's helper and drop "The other apps' configs share the exposure".
   Commit: `docs: …` (spec and plan go in a docs commit first).
