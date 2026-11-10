# Plan: Korbjäger, remove the Team id input, show the search as a link button

Spec: [docs/specs/3007-korbjaeger-team-id-eingabe-entfernen-die-suche-als-link-button-hervorheben.md](../specs/3007-korbjaeger-team-id-eingabe-entfernen-die-suche-als-link-button-hervorheben.md)

1. **Overview offers "Weiteres Team suchen".** Test first in `apps/korbjaeger/src/app/ueberblick/ueberblick.component.spec.ts`: the case "offers no set-up once a Team is followed" becomes "offers to search a further Team once a Team is followed" (link text, `href="/suchen"`, `mat-stroked-button`, no "Team suchen"); a case that neither shows while the choices are read. Then `ueberblick.component.html` (+ `.scss` spacing). Commit `feat(korbjaeger): offer the search below the overview's Teams`.
2. **Remove the Team id form.** Delete `src/app/home/team-id-form.component.ts` and its spec; drop the heading, form and text link from `src/app/pages/(home).page.ts` and its doc comment. Add an e2e check in `e2e/meine-teams.spec.ts` (or `search.spec.ts`) that a followed Team's start page offers "Weiteres Team suchen" leading to `/suchen`, with a locator in `e2e/pos/start.page.ts`. Commit `feat(korbjaeger): drop the Team id input from the home page`.
3. **Checks.** `npx nx format:write`, `npx nx affected -t lint,lint-templates,test`, `npx nx build korbjaeger`, the korbjaeger e2e.
