import type {
  PersonId,
  TeamId,
  VereinId,
} from '@wolsok/feat-shared-basketball-data';
import type { GelesenesDokument, TeamPlatz } from './auswahl-dokument';
import { vorSeit } from './auswahl-eintraege';
import {
  AUSWAHL_GRENZEN,
  AUSWAHL_LISTEN,
  jedeListe,
  LEERE_AUSWAHL,
  listenArt,
  type AuswahlInhalt,
  type AuswahlListe,
  type AuswahlListen,
  type ListenArt,
  type ListenWert,
} from './auswahl-listen';
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
 * Follows `team`, unless it is followed: at `platz`, its old place (before
 * the first Team the reader orders after it; one whose `seit` is not known
 * yet comes after), else at the end of Meine Teams, with no `seit` kept
 * for it, so the write gives it a new one. The one place that sets or
 * clears a Team's `teamsSeit`: one kept for a Team no longer followed is
 * never read.
 */
export function folgenAenderung(
  team: TeamId,
  platz?: TeamPlatz
): AuswahlAenderung {
  return (inhalt) => {
    if (inhalt.teams.includes(team)) {
      return inhalt;
    }
    const teamsSeit = new Map(inhalt.teamsSeit);
    if (platz === undefined) {
      teamsSeit.delete(team);
      return { ...inhalt, teams: [...inhalt.teams, team], teamsSeit };
    }
    const eintrag = { seit: platz.seit, sortierung: team };
    const danach = inhalt.teams.findIndex(
      (andere) =>
        vorSeit(eintrag, {
          seit: inhalt.teamsSeit?.get(andere) ?? Infinity,
          sortierung: andere,
        }) < 0
    );
    const teams = [...inhalt.teams];
    teams.splice(danach === -1 ? teams.length : danach, 0, team);
    return { ...inhalt, teams, teamsSeit: teamsSeit.set(team, platz.seit) };
  };
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
  const seit = inhalt.teams.includes(team)
    ? inhalt.teamsSeit?.get(team)
    : undefined;
  return seit === undefined ? undefined : { seit };
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
  verein: VereinId
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
  return (inhalt) => {
    const uebrig = jedeListe<AuswahlListen>((liste) =>
      ohneGleiche(liste, inhalt, abgegeben)
    );
    return AUSWAHL_LISTEN.every(
      (liste) => uebrig[liste].length === inhalt[liste].length
    )
      ? inhalt
      : // the Teams that stay keep their places (`teamsSeit`)
        { ...inhalt, ...uebrig };
  };
}

/** The entries of `liste` in `inhalt` that `ohneDiese` holds no equal of. */
function ohneGleiche<L extends AuswahlListe>(
  liste: L,
  inhalt: AuswahlListen,
  ohneDiese: AuswahlListen
): readonly ListenWert<L>[] {
  const art: ListenArt<L> = listenArt(liste);
  return inhalt[liste].filter(
    (wert) => !ohneDiese[liste].some((alt) => art.gleich(alt, wert))
  );
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
