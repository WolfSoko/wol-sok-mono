# 19. Korbjäger shows children's data only to those who follow their Team

- Status: accepted
- Date: 2026-11-08
- Scope: `libs/features/basketball-data` (`feat-shared-basketball-data`),
  the coming Korbjäger app, its proxy, storage and fixtures
- Issue: [#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861);
  terms as in the glossary of
  [#2860](https://github.com/WolfSoko/wol-sok-mono/pull/2860)

## Context

The app shows the Kader of youth Spiele: children's names, and in some
Verbände their Spielerwerte. The DBB publishes these on basketball-bund.net
already, but finding a child there takes knowing the Verband, the Liga and
the Team. An app that made them searchable, or gave each player a page,
would publish more than the DBB does. About one in ten youth players is an
Anonymer Spieler: the family objected, and the DBB hides the name.

Elternteile mark their own Kinder in a Kader to have them highlighted, and
signed-in Elternteile keep that choice in Firestore. The specs need real
DBB responses to test against, and those name real children.

## Decision

**No way to find a child the DBB's own pages don't offer.**

- No player search, no player pages, no season statistics or leader boards
  across players. Children appear only inside the Kader of a Spiel of a
  Team someone follows.
- The app never searches Spielberichte for a person: a marked Kind is
  highlighted where their person id appears in a followed Team's Kader,
  nowhere else.
- The app is `noindex` everywhere (meta tag, `X-Robots-Tag` header,
  `robots.txt` with `Disallow: /`) and has no sitemap.

**An Anonymer Spieler stays anonymous.** The domain type has no person id
and no name (`AnonymerSpieler`), so it cannot be marked as a Kind or told
apart from another.

**Store ids, not data.** What the app keeps per Elternteil, on the device
or in one Firestore document per signed-in uid, is the Team ids of Meine
Teams and the person ids of the Kinder, each with an optional nickname.
No names or Spielerwerte from the DBB are stored; they are read fresh,
through the proxy (ADR 0018), whenever they are shown. Deleting the account
deletes the document.

**No real child's name in the repo.** The fixtures are DBB responses with
every person name and id (players, referees, season player ids) replaced
by invented ones, through a seeded mapping in
`tools/korbjaeger/anonymise-fixtures.ts`, which writes nothing if an
original name or id survives. Raw responses are recorded only into a folder
outside the workspace. A spec fails on any name in the committed fixtures
that is not from the invented lists.

## Consequences

- An Elternteil cannot find a child by name; they find the Team through
  Verband, age group and Liga, and mark the child in a Kader.
- A Kind can only be marked once they appeared in a Spielbericht; the app
  explains this to Elternteile whose child has not played yet.
- The privacy policy covers the Google sign-in, the Firestore document
  (Team ids, person ids, nicknames), device storage, Hosting logs and
  deletion; the portfolio does not link the app until the DBB has agreed.
- New fixtures go through the anonymiser; a hand-written one uses names
  from the invented lists.
