# Plan: Korbjäger search C ([#2990](https://github.com/WolfSoko/wol-sok-mono/issues/2990))

Spec: `docs/specs/2990-korbjaeger-search-c-ueber-mein-kind-verein-team-then-mark-the-kind-in-the-kader.md`. Branch off `main`, which holds ticket B (#3006).

1. **Shared hint text.** `src/app/kind/kind-hinweise.ts` (`NACH_ERSTEM_SPIEL`), used by the overview's template; overview spec stays green. Commit `refactor(korbjaeger): one text for the hint after the first Spiel (#2990)`.
2. **The step's decision.** `src/app/search/child-step.ts`: `childStep(saison, heute)` → `{ kind: 'mark', spielId }` or `{ kind: 'after-first-game' }`, over the lib's `zuletztGespielt`; spec first. Commit `feat(korbjaeger): decide the Kind step of a followed Team (#2990)`.
3. **The step's component.** `src/app/search/child-step.component.ts` (`teamSaisonResource`, `HEUTE`, the link, the hint, loading and failure); spec. Commit `feat(korbjaeger): the Kind step of a followed Team (#2990)`.
4. **The Verein's page for the Kind.** `ClubSearchComponent` input `clubLink`; `ClubPageComponent` input `forChild` (passes the step to `VereinsTeamsComponent` through a content slot per followed Team, or the Kind page lists it itself) and its breadcrumb; `src/app/search/child-search-page.component.ts`; pages `pages/suchen/kind/index.page.ts` and `pages/suchen/kind/verein/[id].page.ts`; the section on `/suchen`; specs. Commit `feat(korbjaeger): search "Über mein Kind" on /suchen (#2990)`.
5. **E2E and docs.** `e2e/search.spec.ts`: the Kind flow up to marking on the Spiel page (fake DBB, `/api/clubs` by `page.route`); `/suchen/kind` in `kontrast.spec.ts`; CLAUDE.md's search line. Commit `test(korbjaeger): e2e for the search by Kind (#2990)`.
6. **PR** "Closes #2990", review, test, merge.

Before each commit: `npx nx format:write`, `npx nx affected --base=origin/main -t lint,lint-templates,test`.
