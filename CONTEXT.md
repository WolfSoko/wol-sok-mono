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
