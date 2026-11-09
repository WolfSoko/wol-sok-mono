# Spec: Korbjäger — DBB.Scores terms of use and an official NBN23 partner or API access (no scraping)

Issue: [#2977](https://github.com/WolfSoko/wol-sok-mono/issues/2977). Follows spike [#2947](https://github.com/WolfSoko/wol-sok-mono/issues/2947) ([spec](2947-spike-korbjaeger-does-the-dbb-offer-a-live-data-source-and-would-it-agree-to-its-use.md)); feeds the permission letter of [#2963](https://github.com/WolfSoko/wol-sok-mono/issues/2963); related to [#2975](https://github.com/WolfSoko/wol-sok-mono/issues/2975), [ADR 0018](../adr/0018-korbjaeger-dbb-data-behind-a-caching-proxy.md) and [ADR 0019](../adr/0019-korbjaeger-privacy-stance.md).

A spike: findings and a recommendation, no build. Everything below was read from public pages on 2026-11-09; nothing was fetched through a DBB.Scores account or the app's backend.

## Findings (2026-11-09)

### 1. What DBB.Scores is, and what it sells

DBB.Scores (`com.nbn23.germanapp`, [App Store](https://apps.apple.com/de/app/dbb-scores/id1592686052)) is published by NBN23 S.L.U. (CIF B-40634206, Paterna, Valencia; „A Data Sportstech company" in its footer; NOTHINGBUTNET S.L. in the store listings), not by the DBB. NBN23's German page ([DBB.Scores infos](https://nbn23.com/dbb_scores_infos/)) states:

- „Mittlerweile werden fast 100% aller Spiele digital angeschrieben", and since 2025/26 the Landesverbände no longer want the scoresheet's offline mode, so most Spiele should be live in the app (NBN23 gives no figure for live coverage). This updates [#2947](https://github.com/WolfSoko/wol-sok-mono/issues/2947), which found no published list of covered Ligen.
- The detailed statistics need a paid „Gold" account. The DBB chose this model so that the system costs the Verband, the players and the clubs nothing: „Um nicht jedem Verein und jedem Spieler in Deutschland neue Gebühren für diese Technologie aufzuerlegen, hat der DBB sich entschieden, es jedem selbst zu überlassen ob sie für diese Statistiken bezahlen möchten."

NBN23's shop [DBB Area](https://dbbarea.com/) lists what is free and what is not:

| Free account                      | Gold (29.99 € a year, one person per account)                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| follow 1 person or 1 Team         | unlimited                                                                                                                          |
| current season                    | all seasons                                                                                                                        |
| score updated after each quarter¹ | live game, box score, play-by-play, game chart, leaders, shot map and heat map, lineups, comparison of persons and Teams, pre-game |

¹ The DBB Area FAQ also promises free „Live-Match-Tracking"; the table says the free score is updated after each quarter. DBB Area also sells Gold group plans for Teams and clubs (5 to 500 accounts, billed centrally): still one account per person, not a data licence.

So the detailed and live data the owner sees in DBB.Scores is NBN23's paid product, and NBN23's page implies that Gold pays for the DBB's digital scoresheet, which costs the Verband, players and clubs nothing.

### 2. What the terms of use allow and forbid

The App Store listing links NBN23's shared app terms, [Terms and conditions of use SWISH](https://nbn23.com/terms-and-conditions-of-use-swish/), which apply to „all access points, including (sub)domains and mobile applications, of NBN23 S.L. Products"; the privacy policy ([NBN23 privacy](https://nbn23.com/privacy/)) names DBB.Scores among those products. The website's own [terms of use](https://nbn23.com/terms/) cover nbn23.com. Spanish law; courts of Paterna, Valencia (app terms) or of the city of Valencia (website terms).

Forbidden:

- **Automated access.** Users must „refrain from copying, distributing, transmitting or collecting with the help of technical means, e.g. crawlers or bots, easily accessible information without the consent of the relevant owner" (app terms, user obligations). Reading DBB.Scores through the owner's account by a program, the app's proxy included, is exactly that.
- **Interference with the platform** by technical means (same section). Reverse-engineering the app's private backend to call it is at least close to it; the issue rules it out anyway.
- **Reuse beyond personal use.** „In no case, the user may make a use or use of the services and content on the page that are not exclusively personal"; any reproduction, distribution or public communication needs NBN23's „prior authorization … and the acceptance of the corresponding license" (website terms, intellectual property). Written for nbn23.com; the app terms have no reuse or licence clause beyond the crawler rule above, but this is the only rule NBN23 publishes on reuse, so its authorisation is what to ask for.
- **Deep links and frames.** „Deep-links, IMG or image links, or frames with the pages of the site will not be established without the express prior authorization of NBN23"; a link goes to the main page or a section's page (website terms, hyperlinks). Written for nbn23.com, but it is the only rule NBN23 publishes on linking, so a deep link from a Spiel page into DBB.Scores belongs into the request too.
- **Sharing an account.** Gold is sold per person („1 Konto auf allen Geräten", the Duo as „2 Kontos, 2 verschiedene Personen", DBB Area), the login is to be used diligently and „not share[d] … with third parties" (privacy policy, on the data the user provides), and registration information must not be transmitted to third parties (app terms, user obligations). Showing what the owner's account sees to other parents would pass a personal subscription on.

Allowed without asking: using the app personally, and linking NBN23's main page or the DBB.Scores info page (plain hyperlink, no NBN23 logo or brand beside it unless authorised).

**Display in another app** is named nowhere, but it would need automated access or reuse, which the clauses above leave to NBN23's consent or prior authorisation. So the terms allow nothing Korbjäger could build on without NBN23's authorisation, which Korbjäger should insist on getting in writing.

### 3. Is there a partner program or an API?

**No public one.** NBN23 publishes no API, developer documentation, data feed or widget, and its site has no partner or developer page. Its partnerships are B2B deals with organisers: federations (FIBA Europe, the DBB, Switzerland, Italy, Wales, Scotland, …) and event platforms. The one documented integration, [Exposure Events (2022)](https://nbn23.com/the-exposure-events-and-nbn23-integration-is-a-powerhouse-for-the-us-youth-basketball-landscape/), starts with „Contact NBN23 to set up your partnership", and data flows back to the organiser's platform; fans are sent to NBN23's own app. No offer for third-party fan or parent apps was found.

Contacts NBN23 names publicly:

| For                              | Address                                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| German DBB.Scores users          | `info.de@nbn23.tech` („Kontakt" in the footer of [DBB Area](https://dbbarea.com/); also in NBN23's App Store replies) |
| General enquiries                | the form on [nbn23.com/contact](https://www.nbn23.com/contact/)                                                       |
| Data protection (DPO)            | `dpo@nbn23.tech`                                                                                                      |
| Premium (Gold) terms             | `administracion@nbn23.com` (app terms)                                                                                |
| Licences under the website terms | „prior authorization from NBN23"; no address of its own, so the contact form or `info.de@`                            |

Conditions: none published. Any access would be a contract with NBN23, which owns the product and the revenue, and it needs the DBB's agreement, whose data and digital scoresheet it is ([#2947](https://github.com/WolfSoko/wol-sok-mono/issues/2947)).

### 4. Privacy limits

- **Children's data.** The players of youth Ligen are mostly children. ADR 0019 holds: no search, no player pages, no season statistics or leader boards, nothing stored from a Spielbericht. NBN23's Gold features (leaders, comparison of persons, all seasons) are exactly what ADR 0019 rules out, so only a Spiel's own live score, box score and play-by-play could ever fit, and only inside a followed Team's Spiel, read fresh, never kept on the device.
- **The consent the DBB collects.** For the WNBL the DBB's form ([WNBL video rules with consent form](https://www.basketball-bund.de/wp-content/uploads/sites/2/2026/04/Anlage-WNBL-Videorichtlinien-mit-Einverstaendniserklaerung.docx)) has guardians, and players from 16 themselves, consent to the „Veröffentlichung dieser Daten und der individuellen Statistiken in der DBB-Scores-App sowie den entsprechenden Internetseiten wie basketball-bund.net". For the statistics it names DBB.Scores and „such" websites as basketball-bund.net, no other app; its first point also covers names, age, height and nationality „zur Berichterstattung durch Dritte", which only the DBB can read for an app. No such form was found for other Ligen; the DBB hides a player's name where the family objected (the Anonymer Spieler of ADR 0019). Whether that consent, or whatever basis the DBB uses elsewhere, covers display in Korbjäger only the DBB can say. Its data protection officer is `datenschutz@basketball-bund.de`.
- **NBN23's own policy** covers its app users (registration, marketing, profiling; no registration under 16), not the players whose games are recorded; it names „relevant sports federations" as recipients. It says nothing about passing game data to third parties, so a licence would have to.
- **The privacy policy of Korbjäger** would name NBN23 as a further source, and a live answer names players per action: never kept on the device, like a Spielbericht (ADR 0019).

### 5. What to add to the permission letter ([#2963](https://github.com/WolfSoko/wol-sok-mono/issues/2963))

#2963 already asks the DBB about the eight reads, live data and a DBB.Scores deep link. Add:

1. **To the DBB:** whether the consent it collects for publishing statistics (the WNBL form names DBB.Scores and basketball-bund.net) and whatever basis it uses in the other Ligen covers showing a Spiel's Kader and Spielerwerte in Korbjäger, to parents who follow the Team, without search or player pages (ADR 0019). And whether it agrees that NBN23 licenses its live data for that use, given that, per NBN23, Gold pays for the digital scoresheet.
2. **To NBN23** (`info.de@nbn23.tech`, copying the DBB): whether it offers a licence or API for a non-commercial parents' app, limited to a followed Team's Spiel (live score, box score, play-by-play, no leaders, comparisons or season data), behind a shared cache of 15 to 30 s (about two requests a minute per live game, #2947), on which terms and at what price; and whether Korbjäger may deep-link a Spiel into DBB.Scores (the website terms require express prior authorisation for deep links).
3. **A fallback to ask NBN23 for**, should data be refused: a public per-game link format into DBB.Scores (app link or web page), so a Spiel page can link out without any data; NBN23 keeps its Gold sale.
4. **To both:** that Korbjäger reads nothing from DBB.Scores until both agreed in writing.

## Goal

The owner knows what NBN23's terms allow, that there is no public API or partner program, whom to write to, and what the letter of #2963 must ask, so they can decide on detailed or live data without breaking NBN23's terms or ADR 0019.

## Non-goals

- Building anything: no read, route, port or link.
- Any access through a DBB.Scores account or the app's backend, automated or not.
- Writing or sending the letter: #2963, by the owner.

## Decisions

| Decision                                                                                                                                                           | Reason                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Recommendation: no use of DBB.Scores data in Korbjäger, and no deep link to a Spiel in it, without NBN23's authorisation in writing (and the DBB's agreement).** | The terms forbid automated access, reuse beyond personal use and deep links without NBN23's authorisation; the data is NBN23's paid Gold product, and the DBB's consent names DBB.Scores and websites such as basketball-bund.net, no other app. |
| Ask through #2963's letter, extended by section 5, and write to NBN23 at `info.de@nbn23.tech` with the DBB in copy.                                                | NBN23 has no partner or API page; its partnerships run through the organiser, and the DBB has to agree to its data's use anyway.                                                                                                                 |
| Ask for a deep link first, data second.                                                                                                                            | A link costs NBN23 nothing and leaves its Gold sale intact, so it is the likelier yes; it needs no feed, no cache and no new privacy text beyond the link.                                                                                       |
| Should a licence come: only a followed Team's Spiel, read fresh through the proxy's shared cache, never stored.                                                    | ADR 0018's cache and ADR 0019's limits hold for any source.                                                                                                                                                                                      |
| [#2975](https://github.com/WolfSoko/wol-sok-mono/issues/2975) stays on the DBB's own box score.                                                                    | It shows what basketball-bund.net already publishes; nothing there depends on NBN23.                                                                                                                                                             |

## Acceptance

1. The spec says what NBN23's terms allow and forbid (automated access, reuse, display in another app), with the clauses quoted and linked.
2. It says whether there is a partner program or API, with contact and conditions.
3. It lists what to add to the permission letter of #2963.
4. It states the privacy limits: children's data, the consent the DBB collects, ADR 0019.
5. It gives a recommendation. Nothing is built; `nx format:check` passes on the docs.

## Open questions

- Does DBB.Scores have a public per-game link (a web page or an app link) at all? Only the app or NBN23 can tell; asked in section 5.
- What legal basis does the DBB use to publish youth Spielerwerte outside the WNBL? Asked in section 5.
