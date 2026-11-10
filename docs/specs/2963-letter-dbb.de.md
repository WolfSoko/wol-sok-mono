# Brief an den DBB

Zu [#2963](https://github.com/WolfSoko/wol-sok-mono/issues/2963), [Spec](2963-korbjaeger-permission-request-to-the-dbb-and-nbn23-before-going-public.md). Der Eigentümer schickt ihn selbst; `[…]` füllt er vor dem Versand aus.

**An:** `info@basketball-bund.de`
**Kopie:** `datenschutz@basketball-bund.de`
**Betreff:** Anfrage: Nutzung der Spieldaten von basketball-bund.net in der Eltern-App „Korbjäger“

---

Sehr geehrte Damen und Herren,

ich bin Softwareentwickler und habe für Eltern von Kindern in Jugendligen die Web-App **Korbjäger** gebaut (`https://korb.wolsok.de`): Sie zeigt den Spielplan, die Ergebnisse, die Tabelle und den Kader der Teams, denen ein Elternteil folgt, so dass man nicht jede Woche Verband, Liga und Team auf basketball-bund.net neu heraussuchen muss. Die App ist kostenlos, ohne Werbung und ohne Bezahlfunktionen.

Bevor ich die App öffentlich mache, möchte ich Sie um Ihre Zustimmung bitten und Ihnen offenlegen, was sie heute schon tut.

## Was Korbjäger heute tut

<!-- Owner: this paragraph discloses that the app already reads the API and offers to stop at once. Whether to send it as it stands is your decision; adjust it before sending if you want. -->

Die App läuft bereits, aber nicht öffentlich: Sie ist für Suchmaschinen gesperrt (`noindex` auf jeder Seite und in jeder Antwort, keine Sitemap), nirgends verlinkt und wird von einem kleinen Kreis von Eltern genutzt. Sie liest dafür dieselbe JSON-Schnittstelle unter `https://www.basketball-bund.net/rest`, die auch die Seiten von basketball-bund.net lesen. Ich weiß, dass diese Schnittstelle nicht veröffentlicht ist und Ihnen niemand ihre Nutzung zugesagt hat. Wenn Sie das nicht möchten, stelle ich sie sofort ab.

Die Browser der Eltern rufen nie Ihren Server auf, sondern einen eigenen Zwischenspeicher (Proxy) der App. Nur dieser fragt bei Ihnen an, und nur diese acht Abfragen, mit numerischen Kennungen geprüft; jede andere Anfrage weist er ab:

| Abfrage                                            | wofür                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `POST wam/data`                                    | Ligen eines Verbands und einer Altersklasse                                                        |
| `POST wam/liga/list?startAtIndex=…`                | weitere Seiten dieser Ligenliste                                                                   |
| `GET competition/table/id/{ligaId}`                | Tabelle einer Liga                                                                                 |
| `GET competition/spielplan/id/{ligaId}`            | Spielplan einer Liga                                                                               |
| `GET team/id/{teamId}/matches`                     | Spiele eines Teams                                                                                 |
| `GET club/id/{vereinId}/actualmatches?rangeDays=…` | Spiele eines Vereins der nächsten Wochen (für das Vereinsverzeichnis nur eines Tages, siehe unten) |
| `GET match/id/{spielId}/matchInfo`                 | Angaben zu einem Spiel (Halle, Uhrzeit)                                                            |
| `GET match/id/{spielId}/boxscore`                  | Spielbericht: Kader und, wo erfasst, Spielerwerte                                                  |

Jede Antwort wird zwischengespeichert: eine Minute im Browser, fünf Minuten im Netz des Hostings (Firebase Hosting von Google), der Spielbericht eines fertigen Spiels mit bestätigtem Ergebnis eine Stunde. Wie viele Eltern auch zuschauen, Ihr Server sieht dadurch höchstens eine Anfrage je Abfrage und Kennung alle paar Minuten (je Standort des Hosting-Netzes). Der Proxy meldet sich mit dem User-Agent `Korbjaeger/<Version> (+https://korb.wolsok.de)`, sendet keine Cookies und nimmt keine an.

### Das Vereinsverzeichnis

Damit Eltern ihren Verein über den Namen finden können, hält die App ein eigenes Verzeichnis der Vereine. Eine Vereinssuche, die die App nutzen könnte, habe ich bei Ihnen nicht gefunden; das Verzeichnis entsteht deshalb nur aus den Abfragen oben:

- **Was:** einmal in der Woche je Verband alle Seiten seiner Ligen (`wam/data`, `wam/liga/list`), der Spielplan jeder Liga (`competition/spielplan`) für die Vereinskennungen ihrer Teams und, nur für einen noch unbekannten Verein, dessen Spiele eines einzigen Tages (`club/id/{vereinId}/actualmatches?rangeDays=1`), nur um seinen Namen zu lesen.
- **Was bleibt:** Kennung und Name jedes Vereins und die Verbände, in denen er spielt. Keine Personen, keine Teams, keine Kontaktdaten.
- **Last:** eine Anfrage nach der anderen, eine Sekunde Abstand, aus einem zeitgesteuerten Dienst mit eigenem User-Agent (`Korbjaeger-ClubIndex (+https://korb.wolsok.de)`), ohne Cookies. Etwa 2.600 Anfragen in der Woche, über die Stunden verteilt (der größte Verband braucht etwa acht Minuten). Die Eltern bekommen die Liste aus einem Zwischenspeicher, der sie einen Tag hält; ihr Suchtext verlässt das Gerät nicht.
- Bieten Sie eine Vereinssuche an oder ist Ihnen eine andere Quelle lieber, nutze ich diese und stelle das Verzeichnis ab.

### Kinderdaten

Die Spieler in Jugendligen sind meist Kinder. Die App macht deshalb nichts auffindbar, was Ihre eigenen Seiten nicht schon zeigen:

- keine Spielersuche, keine Spielerseiten, keine Saisonstatistiken oder Bestenlisten;
- Kinder erscheinen nur im Kader eines Spiels eines Teams, dem jemand folgt;
- ein von Ihnen anonymisierter Spieler bleibt anonym und kann nicht markiert werden;
- gespeichert werden nur Kennungen (die gefolgten Teams, die als „mein Kind“ markierten Personen, ein optionaler Spitzname, Vereinsfarben), auf dem Gerät oder, nach freiwilliger Anmeldung, in einem Konto; Namen und Spielerwerte werden bei jeder Anzeige frisch gelesen und nie gespeichert; für die Offline-Anzeige behält das Gerät die letzten Antworten zu Spielplänen und Tabellen höchstens sieben Tage, ohne die Personen darin, einen Spielbericht nie.

## Meine Fragen

1. **Die acht Abfragen:** Darf Korbjäger sie so, hinter dem beschriebenen Zwischenspeicher, nutzen und die App öffentlich machen? Wünschen Sie eine andere Anfragerate oder längere Zwischenspeicherzeiten, eine bestimmte Kennzeichnung der Anfragen oder einen Quellenhinweis in bestimmter Form? Gibt es eine offizielle Schnittstelle, die ich stattdessen nutzen sollte?
2. **Das Vereinsverzeichnis:** Sind Sie mit dem wöchentlichen Abruf wie oben einverstanden, oder bieten Sie eine Vereinssuche an, die ich stattdessen nutzen soll?
3. **Kader und Spielerwerte:** Für die WNBL holen Sie die Einwilligung der Spielerinnen bzw. der Erziehungsberechtigten zur Veröffentlichung ihrer Daten und Statistiken in der DBB-Scores-App und auf Seiten wie basketball-bund.net ein. Deckt diese Einwilligung, oder die Grundlage, auf der Sie in den übrigen Ligen veröffentlichen, die Anzeige des Kaders und der Spielerwerte eines Spiels in Korbjäger ab, nur für Eltern, die dem Team folgen, und ohne Suche oder Spielerseiten?
4. **Live-Daten:** basketball-bund.net bietet während eines Spiels keine Live-Daten; diese gibt es nur in der App DBB.Scores von NBN23, die der digitale Spielberichtsbogen speist. Dürfte Korbjäger Live-Daten eines Spiels zeigen, und wenn ja, von wem (von Ihnen oder von NBN23) und mit welcher Anfragerate? Geplant wäre ein gemeinsamer Zwischenspeicher von 15 bis 30 Sekunden: etwa zwei (bei 30 s) bis vier (bei 15 s) Anfragen in der Minute je laufendem Spiel und Standort des Hosting-Netzes, unabhängig von der Zahl der Zuschauer.
5. **Lizenz durch NBN23:** Nach den Angaben von NBN23 finanziert das Gold-Abo von DBB.Scores den digitalen Spielberichtsbogen. Wären Sie einverstanden, dass NBN23 Live-Daten für diese Nutzung an Korbjäger lizenziert? Ich frage NBN23 mit gleicher Post an und setze Sie in Kopie.
6. **Link auf DBB.Scores:** Wären Sie einverstanden, dass eine Spielseite in Korbjäger direkt auf das Spiel in DBB.Scores verlinkt, ganz ohne Daten daraus zu zeigen? Auch dazu frage ich NBN23 um Erlaubnis.

Bis Sie und NBN23 schriftlich zugestimmt haben, liest Korbjäger nichts aus DBB.Scores und verlinkt kein Spiel dorthin.

Gerne stelle ich Ihnen die App vor, gebe Ihnen Zugang oder passe sie an Ihre Vorgaben an. Und wenn Sie die Nutzung Ihrer Daten nicht wünschen, genügt eine kurze Nachricht: Dann nehme ich die App vom Netz.

Mit freundlichen Grüßen

[Name]
[Anschrift]
[E-Mail]

Angaben zum Anbieter: `https://korb.wolsok.de/impressum`, Datenschutzerklärung: `https://korb.wolsok.de/privacy`
