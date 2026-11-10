# Korbjäger search C: "Über mein Kind": Verein, Team, then mark the Kind in the Kader

Issue: [#2990](https://github.com/WolfSoko/wol-sok-mono/issues/2990), ticket C of [#2958](https://github.com/WolfSoko/wol-sok-mono/issues/2958) (spec in [PR #2959](https://github.com/WolfSoko/wol-sok-mono/pull/2959)). Builds on ticket B, [#2989](https://github.com/WolfSoko/wol-sok-mono/issues/2989) ([PR #3006](https://github.com/WolfSoko/wol-sok-mono/pull/3006)): `/suchen` with the search by Verein and `/suchen/verein/:id`.

## Goal

An Elternteil who wants to mark their Kind gets there in one flow: find the Verein, follow the Kind's Team, open that Team's last played Spiel and mark the Kind in its Kader, without knowing that marking happens on a Spiel page.

## Non-goals

- A search by a child's name, a player page or an index of persons (ADR 0019 stays, request 773). The Kind is found only through its Team's Kader.
- Any change to the marking itself (`src/app/kind/`), the Spiel page's Kader or the club index.
- Offering the flow from a followed Team's card on the overview (open question 2 of #2958): the overview already hints how to mark a Kind; left out to keep this ticket small.

## Decisions

1. **Pages.** `/suchen` gets a third section "Über mein Kind" (between "Über den Verein" and "Über die Liga") with a link "Über mein Kind suchen" to `/suchen/kind` (`pages/suchen/kind/index.page.ts`). That page explains the three steps and holds the same Verein search, its hits linking to `/suchen/kind/verein/:id` (`pages/suchen/kind/verein/[id].page.ts`). One search field per page; reusing B's `ClubSearchComponent` with an input for where a hit leads (`clubLink`, default `/suchen/verein`), so the term (`ClubSearchTerm`) and the index stay shared.
2. **The Verein's page in the Kind flow.** `ClubPageComponent` gets an input `forChild`; with it, every Team of the Verein that is followed also shows its next step, `ChildStepComponent` (`src/app/search/child-step.component.ts`): it reads the Team's Saison through `teamSaisonResource` (as the Team page) and takes `zuletztGespielt(saison, heute, 1)` from the lib. A played Spiel gives the link "Kind im Kader markieren" to `/spiel/{id}`, whose Kader of the followed side already offers "Als mein Kind markieren"; none gives the existing hint ("Dein Kind kannst du markieren, sobald es nach seinem ersten Spiel in einem Spielbericht steht."); a failed read gives the app's error text for it. A Team not followed shows only the follow control, with a line on top saying to follow the Kind's Team first. The decision which step shows is a pure function (`childStep(saison, heute)`) with its spec.
3. **Why link to the Spiel page and not show the Kader here.** The Spiel page already reads the Spielbericht, shows the followed side's Kader with the marking, its failures (`KIND_AENDERUNG`) and the Vereinsfarben; a second Kader view would duplicate all of it. Following first is required by the Spiel page (`KaderTeil.gefolgt`), which the flow therefore asks for in order.
4. **Shared texts.** The "after the first Spiel" hint moves into one constant (`AFTER_FIRST_GAME_HINT`, `src/app/kind/child-hints.ts`; the folder `src/app/kind` keeps its name until #2967) used by the overview and the new step, so both say the same.
5. **Breadcrumbs.** `/suchen/kind`: `Suchen › Mein Kind`. `/suchen/kind/verein/:id`: `Suchen › Mein Kind › <Verein's name>`.
6. **English names, German texts** (Coding Rule 10, `deutsche-texte.spec.ts`); `noindex` like every page, no sitemap, no analytics.

## Acceptance

1. `/suchen` shows "Über mein Kind" with a link to `/suchen/kind`.
2. On `/suchen/kind`, typing `wasbuttel` lists `MTV Wasbüttel` as a link to `/suchen/kind/verein/<id>`; B's `/suchen` hits still link to `/suchen/verein/<id>`.
3. On `/suchen/kind/verein/:id` each Team has "Team folgen"; once followed, a Team with a played Spiel shows "Kind im Kader markieren", linking to that Team's last played Spiel; a Team without one shows the "after the first Spiel" hint.
4. Following the link, the Spiel page's Kader of the followed Team offers "Als mein Kind markieren", and marking a player there makes it a Kind (as today).
5. Breadcrumbs as in decision 5; `/suchen/verein/:id` (B) shows no Kind step.
6. No request carries a name or the typed term; nothing new is stored.
7. `deutsche-texte.spec.ts`, `theme.spec.ts` and the contrast e2e stay green; `nx affected -t lint,lint-templates,test,typecheck-specs,build` and the korbjaeger e2e are green.

## Open questions

None.
