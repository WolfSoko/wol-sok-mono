import { inject, Injector } from '@angular/core';
import {
  kaderDesTeams,
  kinderImKader,
  type PersonId,
  type Spiel,
  type SpielId,
  type TeamId,
} from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DatenResource,
} from '../basketball-data/basketball-data-resource';
import type { KorbjaegerData } from '../basketball-data/basketball-data.provider';
import type { KorbReadOptions } from '../basketball-data/lesung';

/**
 * How many of a Team's last played Spiele the overview looks into for the
 * marked Kinder (`zuletztGespielt`). A Kind missing from all of them
 * leaves the Team among the Teams without a Kind.
 */
export const KADER_SUCHE_SPIELE = 5;

/** What to look for in one followed Team's Kader. */
export interface KaderSucheAuftrag {
  readonly team: TeamId;
  /** Its last played Spiele, newest first (`zuletztGespielt`). */
  readonly spiele: readonly Spiel[];
  /** The marked Kinder's persons. */
  readonly kinder: readonly PersonId[];
}

/** The Kinder in one Kader: each person found, with their first name. */
export type KinderImKader = ReadonlyMap<PersonId, string>;

/** What one Team's Spielberichte told of the marked Kinder. */
export interface KaderFunde {
  /**
   * Each Spiel read, newest first: the Kinder on the Team's own Kader, or
   * `undefined` where the Spiel has no Spielbericht yet.
   */
  readonly spiele: ReadonlyMap<SpielId, KinderImKader | undefined>;
  /**
   * Whether a read failed (offline, the DBB down) and the search stopped
   * there, so a Kind may be in a Kader not read.
   */
  readonly unvollstaendig: boolean;
}

/**
 * Looks for `auftrag.kinder` in the Team's own Kader of its Spiele, newest
 * first, and stops once each was found, so mostly the last Spiel is read
 * alone. Never anywhere else (ADR 0019): only a followed Team's Kader.
 */
export async function kaderSuchen(
  data: Pick<KorbjaegerData, 'spielbericht'>,
  auftrag: KaderSucheAuftrag,
  options?: KorbReadOptions
): Promise<KaderFunde> {
  const spiele = new Map<SpielId, KinderImKader | undefined>();
  const offen = new Set(auftrag.kinder);
  for (const spiel of auftrag.spiele) {
    if (offen.size === 0) {
      break;
    }
    let gefunden: KinderImKader | undefined;
    try {
      gefunden = await kinderIn(data, auftrag, spiel, options);
    } catch (fehler) {
      if (options?.signal?.aborted) {
        throw fehler;
      }
      return { spiele, unvollstaendig: true };
    }
    spiele.set(spiel.id, gefunden);
    gefunden?.forEach((_vorname, person) => offen.delete(person));
  }
  return { spiele, unvollstaendig: false };
}

/** The Kinder in the Team's Kader of `spiel`; none without a Spielbericht. */
async function kinderIn(
  data: Pick<KorbjaegerData, 'spielbericht'>,
  auftrag: KaderSucheAuftrag,
  spiel: Spiel,
  options: KorbReadOptions | undefined
): Promise<KinderImKader | undefined> {
  const bericht = await data.spielbericht(spiel.id, options);
  const kader = bericht && kaderDesTeams(bericht, spiel, auftrag.team);
  if (kader === undefined) {
    return undefined;
  }
  return new Map(
    kinderImKader(kader, auftrag.kinder).map((spieler) => [
      spieler.personId,
      spieler.vorname,
    ])
  );
}

/**
 * A resource running `kaderSuchen` for the order `auftrag` gives, none
 * while it gives none; a new order cancels the last. Created in an
 * injection context, or on `injector`.
 */
export function kaderSucheResource(
  auftrag: () => KaderSucheAuftrag | undefined,
  injector: Injector = inject(Injector)
): DatenResource<KaderFunde | undefined> {
  return basketballDataResource(
    auftrag,
    (data, gegeben, options) => kaderSuchen(data, gegeben, options),
    injector
  );
}

/** Whether two orders look for the same, so the search need not rerun. */
export function gleicherAuftrag(
  a: KaderSucheAuftrag | undefined,
  b: KaderSucheAuftrag | undefined
): boolean {
  if (a === undefined || b === undefined) {
    return a === b;
  }
  return (
    a.team === b.team &&
    gleicheListe(
      a.spiele.map(({ id }) => id),
      b.spiele.map(({ id }) => id)
    ) &&
    gleicheListe(a.kinder, b.kinder)
  );
}

function gleicheListe(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((wert, i) => wert === b[i]);
}
