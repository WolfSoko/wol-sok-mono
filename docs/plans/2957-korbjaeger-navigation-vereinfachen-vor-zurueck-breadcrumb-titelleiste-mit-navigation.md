# Plan: Korbjäger navigation ([#2957](https://github.com/WolfSoko/wol-sok-mono/issues/2957))

Spec: `docs/specs/2957-korbjaeger-navigation-vereinfachen-vor-zurueck-breadcrumb-titelleiste-mit-navigation.md`.

1. **History model.** `src/app/navigation/history.ts` (`History`, `historyAfter`) with `history.spec.ts` first (push, replace, popstate known and unknown, truncation); `app-history.ts` (router events → signal, `back(parentLink)`, `forward()`) with its spec on a test router. Commit `feat(korbjaeger): ...`.
2. **Breadcrumb model.** `breadcrumb.ts` (`Breadcrumb` root service, `Level`, `breadcrumb()` helper clearing on destroy) with its spec. Commit with 3.
3. **Title bar.** `title-bar.component.ts` with spec (levels rendered, `aria-current`, back/forward enabled states and calls, settings button only with `anmeldung`); `app.component.ts` uses it. Commit `feat(korbjaeger): ...`.
4. **Pages declare their levels.** Static pages (`team-einrichten`, `einstellungen`, `privacy`, `impressum`, not found) in their page files; Team page from `TeamComponent`'s Saison; Spiel page via `followedSide` (beside `gefolgterVerein` in `gefolgter-verein.ts`, spec extended). Specs per page level. Commit `feat(korbjaeger): ...`.
5. **E2E.** `e2e/navigation.spec.ts` with a page object `e2e/pos/title-bar.ts`: overview → Team → Spiel, breadcrumb link, back, forward, direct Team page back, 360 px overflow. Commit `test(korbjaeger): ...`.
6. **Checks and docs.** `nx format:write`, affected lint, lint-templates, test, typecheck, korbjaeger e2e; a CLAUDE.md line for the title bar.
