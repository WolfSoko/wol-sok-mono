# 19. Korbjäger shows children only inside a Spiel's Kader

- Status: accepted
- Date: 2026-11-08
- Changed: 2026-11-11 by
  [#3025](https://github.com/WolfSoko/wol-sok-mono/issues/3025): the
  stance describes the Spiel page as built, which shows both sides' Kader
  and limits only the marking and highlighting of a Kind to a followed
  side (the owner's decision: reword the ADR, keep the page)
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
  across players. Children appear only inside the Kader of a Spiel, as the
  DBB publishes it: a Spiel page shows both sides' Kader, whether or not
  someone follows either Team, and the app leads to a Spiel only from its
  Teams, found by Verband, Liga or Verein. Marking a Kind ("Als mein Kind
  markieren") and highlighting a marked one work only in the Kader of a
  followed Team's side.
- The app never searches Spielberichte for a person: a marked Kind is
  highlighted where their person id appears in a followed Team's Kader,
  nowhere else. To group the overview by Kind, it looks only into the
  followed Teams' own Kader of their last five played Spiele: the newest
  first, the rest only where a Kind is still missing; the first name it
  shows there is read fresh and never stored.
- The app is `noindex` everywhere (meta tag and `X-Robots-Tag` header) and
  has no sitemap. `robots.txt` deliberately allows crawling: a URL it blocks
  is never fetched, so its `noindex` would never be read and a linked URL
  could still be listed (decided 2026-11-08, replacing the issue's
  `Disallow: /`).

**An Anonymer Spieler stays anonymous.** The domain type has no person id
and no name (`AnonymerSpieler`), so it cannot be marked as a Kind or told
apart from another.

**Store ids, not data.** What the app keeps per Elternteil, on the device
or in one Firestore document per signed-in uid, is the Team ids of Meine
Teams and the person ids of the Kinder, each with an optional nickname.
No names or Spielerwerte from the DBB are stored; they are read fresh,
through the proxy (ADR 0018), whenever they are shown. Deleting the account
deletes the document. For offline use the device keeps the last good
answer of a Team's Spiele, a Tabelle, a Spiel's match info and a Verein's
Spiele, with every person in it dropped; a Spielbericht is never kept. An
answer older than 7 days is never shown, and one nobody read is deleted
within about an hour after that (at start, on returning to the page and
hourly).

**No real child's name in the repo.** The fixtures are DBB responses with
every person name and id (players, referees, season player ids) replaced
by invented ones, through a seeded mapping in
`tools/korbjaeger/anonymise-fixtures.ts`, which writes nothing if an
original name or id survives. Raw responses are recorded only into a folder
outside the workspace. A spec fails on any name in the committed fixtures
that is not from the invented lists.

## Consequences

- An Elternteil cannot find a child by name; they find the Team through
  Verband, age group and Liga, or through its Verein, and mark the child in
  a Kader.
- A Kind can only be marked once they appeared in a Spielbericht; the app
  explains this to Elternteile whose child has not played yet.
- The privacy policy (`/privacy`, #2874) covers the Google sign-in, the
  Firestore document (Team ids, person ids, nicknames), device storage,
  the proxy's and Hosting's logs, the DBB as the source and deletion; the
  portfolio does not link the app until the DBB has agreed. The sign-in is
  live in production since #2873 (the owner's decision of 2026-11-09),
  with the Firestore rules (`apps/korbjaeger/firestore.rules`) deployed
  with the app. The Firestore database of the project `korbjaeger` is in
  `europe-west3` (Frankfurt), while the Nitro function serving the DBB
  proxy runs in `europe-central2`: a function that reads or writes
  Firestore (as the Auth-deletion function of #2912) belongs in
  `europe-west3`, next to the data. A visitor who never opens the settings
  loads no part of Firebase, so Google learns nothing of them; opening the
  settings loads Firebase Auth ahead of the click (on Safari and mobile
  with Google's sign-in frame), as Safari opens a popup only then.
- New fixtures go through the anonymiser; a hand-written one uses names
  from the invented lists.
