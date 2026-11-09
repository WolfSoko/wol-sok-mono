import { AUSWAHL_GRENZEN, type AuswahlInhalt } from './auswahl-dokument';
import type { VereinsfarbenWahl } from '../vereinsfarben/vereinsfarben';
import type { Kind } from './kind';

/** The device's Teams, Kinder and Vereinsfarben that did not fit into the account. */
export type NichtUebernommen = AuswahlInhalt;

/** What `zusammenfuehren` gives: the account's choices, and what was left out. */
export interface Zusammenfuehrung {
  readonly inhalt: AuswahlInhalt;
  readonly uebrig: NichtUebernommen;
}

/**
 * What an account holds once the device's choices joined it at sign-in:
 * the account's Teams, then the device's others; the account's Kinder,
 * a missing Spitzname filled from the device's, then the device's others;
 * the account's Vereinsfarben, then the device's for the other Vereine;
 * the device's only up to the caps (`AUSWAHL_GRENZEN`), in their order,
 * the ones left out in `uebrig`. Each list, and `konto` itself,
 * comes back as it was where the device adds nothing, so a second sign-in
 * with the same choices changes nothing (idempotent).
 */
export function zusammenfuehren(
  konto: AuswahlInhalt,
  geraet: AuswahlInhalt
): Zusammenfuehrung {
  const neueTeams = geraet.teams.filter((team) => !konto.teams.includes(team));
  const teamsPlatz = platz(konto.teams.length, AUSWAHL_GRENZEN.teams);
  const teams =
    neueTeams.length === 0 || teamsPlatz === 0
      ? konto.teams
      : [...konto.teams, ...neueTeams.slice(0, teamsPlatz)];
  const kinder = kinderZusammen(konto.kinder, geraet.kinder);
  const vereinsfarben = vereinsfarbenZusammen(
    konto.vereinsfarben,
    geraet.vereinsfarben
  );
  const uebrig = {
    teams: neueTeams.slice(teamsPlatz),
    kinder: kinder.uebrig,
    vereinsfarben: vereinsfarben.uebrig,
  };
  if (
    teams === konto.teams &&
    kinder.liste === konto.kinder &&
    vereinsfarben.liste === konto.vereinsfarben
  ) {
    return { inhalt: konto, uebrig };
  }
  return {
    inhalt: {
      teams,
      kinder: kinder.liste,
      vereinsfarben: vereinsfarben.liste,
    },
    uebrig,
  };
}

function vereinsfarbenZusammen(
  konto: readonly VereinsfarbenWahl[],
  geraet: readonly VereinsfarbenWahl[]
): {
  readonly liste: readonly VereinsfarbenWahl[];
  readonly uebrig: readonly VereinsfarbenWahl[];
} {
  const imKonto = new Set(konto.map(({ vereinId }) => vereinId));
  const neue = geraet.filter(({ vereinId }) => !imKonto.has(vereinId));
  const frei = platz(konto.length, AUSWAHL_GRENZEN.vereinsfarben);
  const dazu = neue.slice(0, frei);
  return {
    liste:
      dazu.length === 0
        ? konto
        : [...konto, ...dazu].sort((a, b) => a.vereinId - b.vereinId),
    uebrig: neue.slice(frei),
  };
}

function kinderZusammen(
  konto: readonly Kind[],
  geraet: readonly Kind[]
): { readonly liste: readonly Kind[]; readonly uebrig: readonly Kind[] } {
  const ausGeraet = new Map(geraet.map((kind) => [kind.personId, kind]));
  let ergaenzt = false;
  const mitSpitznamen = konto.map((kind) => {
    const spitzname = ausGeraet.get(kind.personId)?.spitzname;
    if (kind.spitzname !== undefined || spitzname === undefined) {
      return kind;
    }
    ergaenzt = true;
    return { personId: kind.personId, spitzname };
  });
  const imKonto = new Set(konto.map((kind) => kind.personId));
  const neue = geraet.filter((kind) => !imKonto.has(kind.personId));
  const kinderPlatz = platz(konto.length, AUSWAHL_GRENZEN.kinder);
  const dazu = neue.slice(0, kinderPlatz);
  const uebrig = neue.slice(kinderPlatz);
  return ergaenzt || dazu.length > 0
    ? { liste: [...mitSpitznamen, ...dazu], uebrig }
    : { liste: konto, uebrig };
}

/** How many more fit beside `belegt` under `grenze`. */
function platz(belegt: number, grenze: number): number {
  return Math.max(0, grenze - belegt);
}
