# Korbjäger: remove the Team id input, show the search as a link button

Issue: [#3007](https://github.com/WolfSoko/wol-sok-mono/issues/3007). Related: [#2989](https://github.com/WolfSoko/wol-sok-mono/issues/2989) (the search `/suchen`), [#2958](https://github.com/WolfSoko/wol-sok-mono/issues/2958), [#2957](https://github.com/WolfSoko/wol-sok-mono/issues/2957) (title bar).

## Goal

No Elternteil has a DBB Team id at hand. The home page stops asking for one and offers the search (`/suchen`, by Verein or Liga) as a button instead of a text link.

## Non-goals

- Any change to `/suchen`, the wizard or the Team page; `/team/{id}` stays reachable by URL.
- The title bar's search action stays as it is.
- `parseDbbId` stays in the lib: the proxy and the routes use it.

## Decisions

1. **Remove the form.** `TeamIdFormComponent` (`src/app/home/team-id-form.component.ts`) and its spec go, and with them the home page's "Team öffnen" heading and the text link "Keine Team-ID zur Hand? Such das Team …". The `home/` folder is then empty and goes too.
2. **The button lives in the overview.** The overview (`UeberblickComponent`) already offers "Team suchen" as a flat link button (`<a mat-flat-button routerLink="/suchen">`) while no Team is followed. It also knows when Teams are followed, so it offers the search there too, after the lists: "Weiteres Team suchen", a `mat-stroked-button` link, quieter than the empty overview's flat one, so the cards keep the weight. Putting it in the home page would show two buttons to the same place while the overview is empty, or make the page reach into the overview's state.
3. **When it shows.** "Team suchen" while the overview has neither Kinder nor Teams (unchanged); "Weiteres Team suchen" once it has a Kind or a Team. Neither while Meine Teams are still read (`undefined`) or cannot be read (`nichtLesbar`): the title bar's search is there in every case.
4. **Texts.** German, as the app's UI; the home page's lead sentence stays.

## Acceptance

1. The home page shows no Team id field, no "Team öffnen" heading and no "Keine Team-ID zur Hand?" text; no code references `TeamIdFormComponent`.
2. While no Team is followed, the overview shows the link button "Team suchen" to `/suchen` (unchanged) and no "Weiteres Team suchen".
3. Once a Team (or a Kind) is followed, the overview shows the link button "Weiteres Team suchen" to `/suchen`, after the cards, and no "Team suchen".
4. While Meine Teams are read or cannot be read, neither button shows.
5. Both are anchors styled as Material buttons (`mat-flat-button`, `mat-stroked-button`), not plain text links.
6. `deutsche-texte.spec.ts`, `theme.spec.ts`, the overview's specs and the korbjaeger e2e stay green; `nx affected -t lint,lint-templates,test,build` green.

## Open questions

None.
