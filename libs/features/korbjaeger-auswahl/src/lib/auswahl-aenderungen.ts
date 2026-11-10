import type {
  PersonId,
  TeamId,
  ClubId,
} from '@wolsok/feat-shared-basketball-data';
import type { GelesenesDokument, TeamPlatz } from './auswahl-dokument';
import {
  AUSWAHL_GRENZEN,
  AUSWAHL_LISTEN,
  everyList,
  LEERE_AUSWAHL,
  listWithout,
  sinceOf,
  withEntryAt,
  type AuswahlInhalt,
  type SelectionLists,
} from './selection-lists';
import {
  gleicheFarben,
  vereinsfarbenAus,
  type Vereinsfarben,
} from './vereinsfarben';
import { nachVerein, type VereinsfarbenWahl } from './vereinsfarben-wahl';
import { AuswahlVollError } from './auswahl-fehler';
import { kindMit, type MarkierbarerSpieler } from './kind';

/**
 * A change of an `Auswahl`, as every adapter applies it to what it read:
 * the same `inhalt` back where it changes nothing, so an adapter can tell
 * that nothing is to be stored.
 */
export type AuswahlAenderung = (inhalt: AuswahlInhalt) => AuswahlInhalt;

/**
 * Follows `team`, unless it is followed: at `platz`, its old place, else at
 * the end of Meine Teams, where the write gives it a new `since`
 * (`withEntryAt`).
 */
export function folgenAenderung(
  team: TeamId,
  platz?: TeamPlatz
): AuswahlAenderung {
  return (inhalt) =>
    inhalt.teams.includes(team)
      ? inhalt
      : withEntryAt('teams', inhalt, team, platz?.seit);
}

/** Unfollows `team`, if it is followed. */
export function entfolgenAenderung(team: TeamId): AuswahlAenderung {
  return (inhalt) =>
    inhalt.teams.includes(team)
      ? { ...inhalt, teams: inhalt.teams.filter((id) => id !== team) }
      : inhalt;
}

/**
 * The place `team` has in `inhalt`; none where it is not followed, or its
 * `seit` is not known yet.
 */
export function teamPlatz(
  inhalt: AuswahlInhalt,
  team: TeamId
): TeamPlatz | undefined {
  const seit = sinceOf('teams', inhalt, team);
  return seit === undefined ? undefined : { seit };
}

/**
 * Marks `spieler` with `spitzname`, at the end, where the write gives it a
 * new `since`, unless marked already.
 */
export function markierenAenderung(
  spieler: MarkierbarerSpieler,
  spitzname?: string
): AuswahlAenderung {
  return (inhalt) =>
    istMarkiert(inhalt, spieler.personId)
      ? inhalt
      : withEntryAt('kinder', inhalt, kindMit(spieler.personId, spitzname));
}

/** Gives the Kind `person` the Spitzname `spitzname`, if it is marked. */
export function spitznameAenderung(
  person: PersonId,
  spitzname: string | undefined
): AuswahlAenderung {
  const neu = kindMit(person, spitzname);
  return (inhalt) =>
    inhalt.kinder.some(
      (kind) => kind.personId === person && kind.spitzname !== neu.spitzname
    )
      ? {
          ...inhalt,
          kinder: inhalt.kinder.map((kind) =>
            kind.personId === person ? neu : kind
          ),
        }
      : inhalt;
}

/**
 * Sets the colours of `verein` to `farben` (as stored: `vereinsfarbenAus`,
 * which throws `KeineFarbeError` for what is no colour), in place of any
 * it has.
 */
export function vereinsfarbenAenderung(
  verein: ClubId,
  farben: Vereinsfarben
): AuswahlAenderung {
  let neu: VereinsfarbenWahl | undefined;
  return (inhalt) => {
    // checked as it first applies, so an adapter rejects a colour as any
    // failure; applied again (a change still to be stored), it is not
    neu ??= {
      vereinId: verein,
      ...vereinsfarbenAus(farben.primaer, farben.zweite),
    };
    const andere = inhalt.vereinsfarben.filter(
      ({ vereinId }) => vereinId !== verein
    );
    const alt = inhalt.vereinsfarben.find(
      ({ vereinId }) => vereinId === verein
    );
    return alt !== undefined && gleicheFarben(alt, neu)
      ? inhalt
      : { ...inhalt, vereinsfarben: nachVerein([...andere, neu]) };
  };
}

/** Takes the colours of `verein` away, so the app's own apply again. */
export function vereinsfarbenZuruecksetzenAenderung(
  verein: ClubId
): AuswahlAenderung {
  return (inhalt) => {
    const andere = inhalt.vereinsfarben.filter(
      ({ vereinId }) => vereinId !== verein
    );
    return andere.length === inhalt.vereinsfarben.length
      ? inhalt
      : { ...inhalt, vereinsfarben: andere };
  };
}

/**
 * Takes what `abgegeben` holds out: each list's entries as they were (one
 * changed since, a Kind's Spitzname or a Verein's colours, stays). What
 * joined since stays too.
 */
export function abgebenAenderung(abgegeben: AuswahlInhalt): AuswahlAenderung {
  return (selection) => {
    const left = everyList<SelectionLists>((list) =>
      listWithout(list, selection, abgegeben, true)
    );
    return AUSWAHL_LISTEN.every(
      (list) => left[list].length === selection[list].length
    )
      ? selection
      : // the entries that stay keep their places (`since`)
        { ...selection, ...left };
  };
}

/** Unmarks the Kind `person`, if it is marked. */
export function entmarkierenAenderung(person: PersonId): AuswahlAenderung {
  return (inhalt) =>
    istMarkiert(inhalt, person)
      ? {
          ...inhalt,
          kinder: inhalt.kinder.filter((kind) => kind.personId !== person),
        }
      : inhalt;
}

/**
 * Refuses `nachher` where a change made a list longer than its cap
 * (`AUSWAHL_GRENZEN`), with `AuswahlVollError`. A list already over it (as
 * read) may still shrink.
 */
export function grenzenPruefen(
  vorher: AuswahlInhalt,
  nachher: AuswahlInhalt
): void {
  for (const liste of AUSWAHL_LISTEN) {
    if (
      nachher[liste].length > vorher[liste].length &&
      nachher[liste].length > AUSWAHL_GRENZEN[liste]
    ) {
      throw new AuswahlVollError(liste);
    }
  }
}

/** What `gelesen` holds; nothing for no document or a newer version's. */
export function inhaltAus(gelesen: GelesenesDokument): AuswahlInhalt {
  return gelesen.art === 'aktuell' ? gelesen : LEERE_AUSWAHL;
}

function istMarkiert(inhalt: AuswahlInhalt, person: PersonId): boolean {
  return inhalt.kinder.some((kind) => kind.personId === person);
}
