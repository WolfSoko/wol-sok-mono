# Plan #2930: move the offline answer cache into `feat-korbjaeger-antworten`

Spec: [docs/specs/2930-…](../specs/2930-arch-korbjager-move-the-offline-answer-cache-letzte-antworten-into-a-lib.md).
Starts once PR #2937 is on `main`; a move, each task keeps every spec green.

1. **`utils-browser-storage`.** Scaffold `libs/utils/browser-storage` (Jest,
   tag `utils`, path alias), `isStorageFull` test first
   (`is-storage-full.spec.ts`: both quota names true, other `DOMException`s
   and plain errors false). Replace `istSpeicherVoll` in the app and in
   `feat-korbjaeger-auswahl` with it and delete it. Test: `nx test
   utils-browser-storage`, `nx test korbjaeger`, `nx test
   feat-korbjaeger-auswahl`. Commit:
   `refactor(utils-browser-storage): share the storage-full check`.
2. **Scaffold `feat-korbjaeger-antworten`** like `feat-korbjaeger-auswahl`
   (`project.json`, `vite.config.ts`, `tsconfig*.json`, `package.json`,
   `README.md`, `src/index.ts`, `src/test-setup.ts`), alias in
   `tsconfig.base.json`. Check: `nx show project feat-korbjaeger-antworten`.
3. **Move the store.** `git mv` `letzte-antworten.ts` and its spec into
   `src/lib/`; imports to `@wolsok/utils-browser-storage`; export from the
   entry; the app (`proxy-transport`, `basketball-data-resource.spec`,
   `geraete-schluessel`, `datenschutz` and its spec, the upkeep) imports
   from `@wolsok/feat-korbjaeger-antworten`. Test: both projects.
4. **Upkeep function, test first.** `antworten-pflege.spec.ts` in the lib
   (fake timers, a jsdom `document`: clears at once, on becoming visible,
   not while hidden, hourly, nothing after stop), then
   `antworten-pflege.ts`; `LETZTE_ANTWORTEN` uses it; the app spec drops the
   timing cases it now duplicates. Test: both projects.
5. **Device-key check.** Add the lib's `src/` to `EIGENE_LIB_ORDNER`; prove
   once with a temporary unlisted key.
6. **Docs.** CLAUDE.md's Korbjäger section (cache paths), lib READMEs.
7. Commit: `refactor(feat-korbjaeger-antworten): move the answer cache out of korbjaeger`
   after `nx format:write` and `nx affected -t lint,lint-templates`; open
   the PR (`Closes #2930`).
