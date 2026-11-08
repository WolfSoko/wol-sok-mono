# wol-sok-mono

Domain language of the apps in this monorepo. Each app with its own domain gets a section.

## Pacetrainer

A digital running coach that guides a runner through interval training with timers and spoken cues.

### Language

**Konfiguration**:
The runner's settings for a training: number of repetitions, sprint time and recovery time.
_Avoid_: Settings, training data

**Intervall**:
One timed segment of a training, either a sprint or a recovery.
_Avoid_: Exercise, Übung

**Trainingslauf**:
One execution of a training from start until it ends, completed or ended early.
_Avoid_: Run state, runner, training progress

**Phase**:
The stage a Trainingslauf is in: bereit, Vorlauf, läuft, pausiert or beendet.
_Avoid_: Training state, status

**Vorlauf**:
The short countdown before the first Intervall, giving the runner time to get ready.
_Avoid_: Start countdown, getready

**Zusammenfassung**:
The result of a finished Trainingslauf: total time, completed sprints, and whether it was completed or ended early.
_Avoid_: Summary, result, stats

**Ansage**:
A beep or spoken cue that announces the next Intervall or the end of the Trainingslauf.
_Avoid_: Cue, peep, sound

### Relationships

- A **Konfiguration** yields the sequence of **Intervalle** for a **Trainingslauf**; the Trainingslauf keeps it fixed once it starts
- A **Trainingslauf** moves through its **Phasen**: bereit → Vorlauf → läuft ⇄ pausiert → beendet
- A beendet **Trainingslauf** has exactly one **Zusammenfassung**
- **Ansagen** follow the Trainingslauf; they never change it

## Basketball-Eltern-App (Arbeitstitel)

Shows parents the games, results and league standings of the teams their children play in, from the public data of the German Basketball Federation (DBB).

### Language

**Elternteil**:
A signed-in person who follows teams and marks children; anyone following a child counts, grandparents included.
_Avoid_: User, Nutzer, Account

**Verband**:
The association that runs a Liga: a Landesverband, a Regionalliga or the Bundesligen.
_Avoid_: Landesverband (too narrow), Federation

**Verein**:
A basketball club that registers Teams.
_Avoid_: Club

**Saison**:
One playing year, e.g. 2026/2027; only the current Saison is available.
_Avoid_: Season, Spielzeit

**Team**:
One squad of a Verein for one Saison, fixed by age group, gender and team number (e.g. "U14 männlich 2").
_Avoid_: Mannschaft, season team

**Liga**:
A competition a Verband runs within a Saison, with its own schedule and table; a Vorrunde is a Liga of its own.
_Avoid_: Wettbewerb, Staffel, competition

**Spiel**:
One game between two Teams within a Liga.
_Avoid_: Match, Partie

**Spielbericht**:
What the DBB records about a played Spiel: the Kader of both Teams and, where the Verband records them, Spielerwerte.
_Avoid_: Boxscore, Statistik

**Kader**:
The players listed on a Spielbericht for one Team.
_Avoid_: Roster, Aufstellung

**Spielerwerte**:
A player's numbers in one Spiel (points, fouls, free throws, ...); only some Verbände record them.
_Avoid_: Stats, Statistik

**Anonymer Spieler**:
A player on a Kader whose name the DBB hides because the family objected; cannot be told apart or followed.
_Avoid_: Unknown player

**Mein Team**:
A Team an Elternteil follows.
_Avoid_: Favorit, Abo

**Kind**:
A player an Elternteil marked as their own in a Kader; the same Kind can play in several Teams.
_Avoid_: Spieler (for the marked one), Profil

### Relationships

- A **Verein** has many **Teams** per **Saison**; a **Team** belongs to exactly one **Verein**
- A **Team** plays in one or more **Ligen** per **Saison** (e.g. a Vorrunde, then a Hauptrunde) and stays the same **Team** throughout
- A **Spiel** belongs to one **Liga** and has at most one **Spielbericht**
- A **Kind** appears in the **Kader** of the **Spielberichte** of each of its **Teams**; a new **Saison** usually means a new **Team** for the same **Kind**
- An **Elternteil** has any number of **Meine Teams** and **Kinder**; an **Anonymer Spieler** can never become a **Kind**
