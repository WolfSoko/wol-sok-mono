import type { PersonId, TeamId } from '@wolsok/feat-shared-basketball-data';
import {
  AUSWAHL_GRENZEN,
  LEERE_AUSWAHL,
  type AuswahlInhalt,
  type GelesenesDokument,
} from './auswahl-dokument';
import { AuswahlVollError } from './auswahl-fehler';
import { gleicheFolge } from '../gleiche-folge';
import { kindMit, type Kind, type MarkierbarerSpieler } from './kind';

/**
 * A change of an `Auswahl`, as every adapter applies it to what it read:
 * the same `inhalt` back where it changes nothing, so an adapter can tell
 * that nothing is to be stored.
 */
export type AuswahlAenderung = (inhalt: AuswahlInhalt) => AuswahlInhalt;

/** Follows `team`, at the end of Meine Teams, unless it is in them. */
export function folgenAenderung(team: TeamId): AuswahlAenderung {
  return (inhalt) =>
    inhalt.teams.includes(team)
      ? inhalt
      : { ...inhalt, teams: [...inhalt.teams, team] };
}

/** Unfollows `team`, if it is followed. */
export function entfolgenAenderung(team: TeamId): AuswahlAenderung {
  return (inhalt) =>
    inhalt.teams.includes(team)
      ? { ...inhalt, teams: inhalt.teams.filter((id) => id !== team) }
      : inhalt;
}

/** Marks `spieler` with `spitzname`, at the end, unless marked already. */
export function markierenAenderung(
  spieler: MarkierbarerSpieler,
  spitzname?: string
): AuswahlAenderung {
  return (inhalt) =>
    istMarkiert(inhalt, spieler.personId)
      ? inhalt
      : {
          ...inhalt,
          kinder: [...inhalt.kinder, kindMit(spieler.personId, spitzname)],
        };
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
 * Takes what `abgegeben` holds out: its Teams, and its Kinder as they were
 * (one whose Spitzname changed since stays). What joined since stays too.
 */
export function abgebenAenderung(abgegeben: AuswahlInhalt): AuswahlAenderung {
  return (inhalt) => {
    const teams = inhalt.teams.filter(
      (team) => !abgegeben.teams.includes(team)
    );
    const kinder = inhalt.kinder.filter(
      (kind) => !abgegeben.kinder.some((alt) => gleichesKind(alt, kind))
    );
    return teams.length === inhalt.teams.length &&
      kinder.length === inhalt.kinder.length
      ? inhalt
      : { teams, kinder };
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
  for (const liste of ['teams', 'kinder'] as const) {
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

/** Whether two lists of Kinder hold the same Kinder in the same order. */
export function gleicheKinder(a: readonly Kind[], b: readonly Kind[]): boolean {
  return gleicheFolge(a, b, gleichesKind);
}

function istMarkiert(inhalt: AuswahlInhalt, person: PersonId): boolean {
  return inhalt.kinder.some((kind) => kind.personId === person);
}

function gleichesKind(a: Kind, b: Kind): boolean {
  return a.personId === b.personId && a.spitzname === b.spitzname;
}
