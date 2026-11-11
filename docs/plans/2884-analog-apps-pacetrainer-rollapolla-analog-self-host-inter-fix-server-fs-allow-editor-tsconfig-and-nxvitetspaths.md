# Plan #2884: Analog apps: self-host Inter, fix server.fs.allow, editor tsconfig and nxViteTsPaths

Spec: [docs/specs/2884-…](../specs/2884-analog-apps-pacetrainer-rollapolla-analog-self-host-inter-fix-server-fs-allow-editor-tsconfig-and-nxvitetspaths.md).
Each task ends with `npx nx format:write`, `npx nx affected -t lint,lint-templates`
and the tests named, then one commit.

1. **Pacetrainer's fonts guard (red).** Add `apps/pacetrainer/src/self-hosted-fonts.spec.ts`
   (no Google Fonts host in `index.html`, `styles.scss` imports
   `@fontsource/inter`); run `nx test pacetrainer`, see it fail.
2. **Self-host Inter (green).** `npm install @fontsource/inter@5.3.0`; import
   `latin-400/600/700/800.css` in `styles.scss` with rollapolla's comment;
   drop the preconnects and the stylesheet link from `index.html`.
   Tests: `nx test pacetrainer`, `nx build pacetrainer`, grep `dist` for the
   hosts and the `woff2` files. Commit `fix(pacetrainer): self-host Inter`.
3. **Workspace root helper.** `tools/vite/workspace-file.ts` (`tools-vite` has no
   test target; the builds and dev servers cover it); use it for `server.fs.allow` in pacetrainer, rollapolla and
   korbjaeger, and in `nitro-ts-path-aliases.ts`. Tests: build and serve of
   pacetrainer and rollapolla, a Fontsource file fetched from the dev server.
   Commit `fix(tools-vite): allow the workspace root in the Analog dev servers`.
4. **Rollapolla's editor tsconfig.** Include `**/*.ts`, `**/*.mts`; check
   `--listFilesOnly`; fix what `nx lint rollapolla-analog` then reports.
   Commit `fix(rollapolla-analog): include the TypeScript files in tsconfig.editor.json`.
5. **Drop `nxViteTsPaths`.** `resolve: { tsconfigPaths: true }` in all ten
   configs, merged into an existing `resolve`; update comments. Tests:
   `nx affected -t build,test,lint` for the touched projects.
   Commit `chore(nx): replace the deprecated nxViteTsPaths with Vite's tsconfigPaths`.
6. **PR, review, acceptance**: PR with `Closes #2884`, subagent review,
   acceptance list in the description.
