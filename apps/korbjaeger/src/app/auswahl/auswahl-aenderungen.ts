import type {
  PersonId,
  TeamId,
  VereinId,
} from '@wolsok/feat-shared-basketball-data';
import {
  AUSWAHL_GRENZEN,
  LEERE_AUSWAHL,
  type AuswahlInhalt,
  type AuswahlListe,
  type GelesenesDokument,
} from './auswahl-dokument';
import {
  gleicheFarben,
  vereinsfarbenAus,
  type Vereinsfarben,
  type VereinsfarbenWahl,
} from '../vereinsfarben/vereinsfarben';
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
 * Sets the colours of `verein` to `farben` (as stored: `vereinsfarbenAus`,
 * which throws `KeineFarbeError` for what is no colour), in place of any
 * it has.
 */
export function vereinsfarbenAenderung(
  verein: VereinId,
  farben: Vereinsfarben
): AuswahlAenderung {
  return (inhalt) => {
    // checked as it applies, so an adapter rejects a colour as any failure
    const neu: VereinsfarbenWahl = {
      vereinId: verein,
      ...vereinsfarbenAus(farben.primaer, farben.zweite),
    };
    const alt = inhalt.vereinsfarben.find(
      ({ vereinId }) => vereinId === verein
    );
    if (alt !== undefined && gleicheFarben(alt, neu)) {
      return inhalt;
    }
    return {
      ...inhalt,
      vereinsfarben: [
        ...inhalt.vereinsfarben.filter(({ vereinId }) => vereinId !== verein),
        neu,
      ].sort((a, b) => a.vereinId - b.vereinId),
    };
  };
}

/** Takes the colours of `verein` away, so the app's own apply again. */
export function vereinsfarbenZuruecksetzenAenderung(
  verein: VereinId
): AuswahlAenderung {
  return (inhalt) =>
    inhalt.vereinsfarben.some(({ vereinId }) => vereinId === verein)
      ? {
          ...inhalt,
          vereinsfarben: inhalt.vereinsfarben.filter(
            ({ vereinId }) => vereinId !== verein
          ),
        }
      : inhalt;
}

/**
 * Takes what `abgegeben` holds out: its Teams, and its Kinder and
 * Vereinsfarben as they were (one changed since stays). What joined since
 * stays too.
 */
export function abgebenAenderung(abgegeben: AuswahlInhalt): AuswahlAenderung {
  return (inhalt) => {
    const teams = inhalt.teams.filter(
      (team) => !abgegeben.teams.includes(team)
    );
    const kinder = inhalt.kinder.filter(
      (kind) => !abgegeben.kinder.some((alt) => gleichesKind(alt, kind))
    );
    const vereinsfarben = inhalt.vereinsfarben.filter(
      (wahl) =>
        !abgegeben.vereinsfarben.some((alt) => gleicheVereinsfarbe(alt, wahl))
    );
    return teams.length === inhalt.teams.length &&
      kinder.length === inhalt.kinder.length &&
      vereinsfarben.length === inhalt.vereinsfarben.length
      ? inhalt
      : { teams, kinder, vereinsfarben };
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
  for (const liste of Object.keys(AUSWAHL_GRENZEN) as AuswahlListe[]) {
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

/** Whether two lists of Vereinsfarben hold the same colours of the same Vereine. */
export function gleicheVereinsfarben(
  a: readonly VereinsfarbenWahl[],
  b: readonly VereinsfarbenWahl[]
): boolean {
  return gleicheFolge(a, b, gleicheVereinsfarbe);
}

function gleicheVereinsfarbe(
  a: VereinsfarbenWahl,
  b: VereinsfarbenWahl
): boolean {
  return a.vereinId === b.vereinId && gleicheFarben(a, b);
}

function istMarkiert(inhalt: AuswahlInhalt, person: PersonId): boolean {
  return inhalt.kinder.some((kind) => kind.personId === person);
}

function gleichesKind(a: Kind, b: Kind): boolean {
  return a.personId === b.personId && a.spitzname === b.spitzname;
}
