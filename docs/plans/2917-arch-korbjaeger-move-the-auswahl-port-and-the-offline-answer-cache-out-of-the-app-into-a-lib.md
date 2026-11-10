# Plan #2917: move the Auswahl port into `feat-korbjaeger-auswahl`

Spec: [docs/specs/2917-…](../specs/2917-arch-korbjaeger-move-the-auswahl-port-and-the-offline-answer-cache-out-of-the-app-into-a-lib.md).
A pure move: every task keeps the existing specs green.

1. **Scaffold the lib.** `libs/features/korbjaeger-auswahl/` with
   `project.json` (tag `feature`, `test` on `@nx/vitest`, `typecheck-specs`),
   `vite.config.ts`, `tsconfig*.json`, `package.json`, `README.md`,
   `src/index.ts`, `src/testing.ts`, `src/test-setup.ts`; path aliases in
   `tsconfig.base.json`. Check: `nx show project feat-korbjaeger-auswahl`.
2. **Move the code with `git mv`** into `src/lib/` (port, errors, kind,
   colours, document, changes, merge, takeover, adapters, `gleicheFolge`,
   `istSpeicherVoll`) and `src/testing/` (contract, fake), specs with them.
   Fix relative imports. Fill the entries. Test: `nx test
   feat-korbjaeger-auswahl`, `nx typecheck-specs feat-korbjaeger-auswahl`.
3. **Rewire the app.** Replace every `../auswahl/…`,
   `../vereinsfarben/vereinsfarben`, `../gleiche-folge` and
   `istSpeicherVoll` import with the lib's entries; `auswahl.ts` keeps only
   the `AUSWAHL` token; the emulator specs and `src/testing/` import from the
   lib. Test: `nx test korbjaeger`, `nx lint korbjaeger`, build.
4. **Keep the device-key check whole.** `src/testing/app-quellen.ts` walks
   the lib's sources too; prove it once with a temporary unlisted key.
5. **Docs.** CLAUDE.md's Korbjäger section and the architecture README's
   metrics row if it lists projects.
6. Commit: `refactor(feat-korbjaeger-auswahl): move the Auswahl port out of korbjaeger`
   (after `nx format:write` and `nx affected -t lint,lint-templates`).
