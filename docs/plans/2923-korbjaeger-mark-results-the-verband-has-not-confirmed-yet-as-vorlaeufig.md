# Plan: Korbjäger — mark results the Verband has not confirmed yet as vorläufig

Spec: [`docs/specs/2923-korbjaeger-mark-results-the-verband-has-not-confirmed-yet-as-vorlaeufig.md`](../specs/2923-korbjaeger-mark-results-the-verband-has-not-confirmed-yet-as-vorlaeufig.md). Test first, one commit for the whole change (small).

1. **Lib helper.** `libs/features/basketball-data/src/lib/domain/spiel.ts`: `ergebnisVorlaeufig(spiel)`; export from `src/index.ts`. Test: `spiel.spec.ts`, one case per status.
2. **Shared word.** `apps/korbjaeger/src/app/spiel/spiel-format.ts`: `VORLAEUFIG`.
3. **SpielZeile.** `spiel/spiel-zeile.ts` sets `vorlaeufig`; `spiel-zeile.component.ts` renders it. Tests: new `spiel/spiel-zeile.component.spec.ts` (unconfirmed shows the word with score and badge, confirmed does not); Team page spec checks one unconfirmed line.
4. **Spiel page.** `spiel-seite/spiel-kopf.ts` sets `vorlaeufig`; `spiel.component.html`/`.scss` show it beside the score. Test: `spiel.component.spec.ts` unconfirmed and confirmed cases.
5. **Checks.** `npx nx test feat-shared-basketball-data`, `npx nx test korbjaeger`, `npx nx affected -t lint,lint-templates`, `npx nx format:write`, `npx nx build korbjaeger`.
6. **Commit** `feat(korbjaeger): mark unconfirmed results as vorläufig`, PR with `Closes #2923`.
