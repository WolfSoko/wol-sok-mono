import { inject, Injector } from '@angular/core';
import {
  isBasketballDataError,
  kaderDesTeams,
  kinderImKader,
  type PersonId,
  type Spiel,
  type SpielId,
  type Spielbericht,
  type TeamId,
} from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DatenResource,
} from '../basketball-data/basketball-data-resource';
import type { KorbjaegerData } from '../basketball-data/basketball-data.provider';
import type { KorbReadOptions } from '../basketball-data/lesung';
import { gleicheFolge } from '../gleiche-folge';

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

/** One Spiel's read: the Kinder its Kader named, or that it failed. */
type Lesen =
  | { readonly gelesen: true; readonly kinder: KinderImKader | undefined }
  | { readonly gelesen: false };

/**
 * Looks for `auftrag.kinder` in the Team's own Kader of its Spiele, never
 * anywhere else (ADR 0019). Reads the newest Spiel first, which mostly
 * names every Kind already; where one is still missing, it reads the rest
 * side by side, so a Kind in no Kader costs one round trip more, not one
 * per Spiel. A Spielbericht the DBB does not know counts as none yet; a
 * read that fails otherwise (offline, the DBB down) leaves the search
 * `unvollstaendig`, and where the newest failed nothing more is read.
 */
export async function kaderSuchen(
  data: Pick<KorbjaegerData, 'spielbericht'>,
  auftrag: KaderSucheAuftrag,
  options?: KorbReadOptions
): Promise<KaderFunde> {
  const [neuestes, ...rest] = auftrag.spiele;
  if (neuestes === undefined || auftrag.kinder.length === 0) {
    return { spiele: new Map(), unvollstaendig: false };
  }
  const lesen = (spiel: Spiel): Promise<Lesen> =>
    kinderIn(data, auftrag, spiel, options);
  const erstes = await lesen(neuestes);
  const weitere =
    erstes.gelesen && !alleGefunden(erstes.kinder, auftrag.kinder)
      ? await Promise.all(rest.map(lesen))
      : rest.map(() => undefined);
  const spiele = new Map<SpielId, KinderImKader | undefined>();
  let unvollstaendig = false;
  [erstes, ...weitere].forEach((ergebnis, i) => {
    if (ergebnis?.gelesen) {
      spiele.set(auftrag.spiele[i].id, ergebnis.kinder);
    } else if (ergebnis) {
      unvollstaendig = true;
    }
  });
  return { spiele, unvollstaendig };
}

function alleGefunden(
  gefunden: KinderImKader | undefined,
  kinder: readonly PersonId[]
): boolean {
  return kinder.every((person) => gefunden?.has(person));
}

/**
 * The Kinder in the Team's Kader of `spiel`, none where it has no
 * Spielbericht (yet, or the DBB knows none); a failed read as such, unless
 * the search was cancelled, which ends it.
 */
async function kinderIn(
  data: Pick<KorbjaegerData, 'spielbericht'>,
  auftrag: KaderSucheAuftrag,
  spiel: Spiel,
  options: KorbReadOptions | undefined
): Promise<Lesen> {
  let bericht: Spielbericht | undefined;
  try {
    bericht = await data.spielbericht(spiel.id, options);
  } catch (fehler) {
    if (options?.signal?.aborted) {
      throw fehler;
    }
    return isBasketballDataError(fehler, 'not-found')
      ? { gelesen: true, kinder: undefined }
      : { gelesen: false };
  }
  const kader = bericht && kaderDesTeams(bericht, spiel, auftrag.team);
  return {
    gelesen: true,
    kinder:
      kader &&
      new Map(
        kinderImKader(kader, auftrag.kinder).map((spieler) => [
          spieler.personId,
          spieler.vorname,
        ])
      ),
  };
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

/**
 * Whether the search for `b` need not run again after the one for `a`:
 * the same Team and Spiele, and Kinder `a` looked for already. A Kind
 * unmarked thus starts no search; the finds of the others stay as they
 * are, those of the Kind unmarked unused.
 */
export function gleicherAuftrag(
  a: KaderSucheAuftrag | undefined,
  b: KaderSucheAuftrag | undefined
): boolean {
  if (a === undefined || b === undefined) {
    return a === b;
  }
  return (
    a.team === b.team &&
    gleicheFolge(
      a.spiele.map(({ id }) => id),
      b.spiele.map(({ id }) => id)
    ) &&
    b.kinder.length > 0 &&
    b.kinder.every((person) => a.kinder.includes(person))
  );
}
