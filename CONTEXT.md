# wol-sok-mono

Domain language of the apps in this monorepo. Each app with its own domain gets a section.

The terms are in the UI's language and are the words for the UI and for talking about the domain. Code is English (CLAUDE.md, Coding Rule 10): each term's `_Code_` line is its one English name in identifiers, file names and persisted fields. `_Avoid_` lists words not to use for the term in prose and UI texts; an English word there (Summary) is still the code name where `_Code_` names it.

## Pacetrainer

A digital running coach that guides a runner through interval training with timers and spoken cues.

### Language

**Konfiguration**:
The runner's settings for a training: number of repetitions, sprint time and recovery time.
_Code_: `TrainingConfig`
_Avoid_: Settings, training data

**Intervall**:
One timed segment of a training, either a sprint or a recovery.
_Code_: `Interval`
_Avoid_: Exercise, Übung

**Trainingslauf**:
One execution of a training from start until it ends, completed or ended early.
_Code_: `TrainingRun`
_Avoid_: Run state, runner, training progress

**Phase**:
The stage a Trainingslauf is in: bereit, Vorlauf, läuft, pausiert or beendet.
_Code_: `RunPhase`
_Avoid_: Training state, status

**Vorlauf**:
The short countdown before the first Intervall, giving the runner time to get ready.
_Code_: `LeadIn`
_Avoid_: Start countdown, getready

**Zusammenfassung**:
The result of a finished Trainingslauf: total time, completed sprints, and whether it was completed or ended early.
_Code_: `Summary`
_Avoid_: Summary, result, stats

**Ansage**:
A beep or spoken cue that announces the next Intervall or the end of the Trainingslauf.
_Code_: `Announcement`
_Avoid_: Cue, peep, sound

### Relationships

- A **Konfiguration** yields the sequence of **Intervalle** for a **Trainingslauf**; the Trainingslauf keeps it fixed once it starts
- A **Trainingslauf** moves through its **Phasen**: bereit → Vorlauf → läuft ⇄ pausiert → beendet
- A beendet **Trainingslauf** has exactly one **Zusammenfassung**
- **Ansagen** follow the Trainingslauf; they never change it
