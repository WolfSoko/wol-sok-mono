import type { BasketballData, ReadOptions } from '../basketball-data';
import { isBasketballDataError } from './basketball-data-error';
import type { PersonId, SpielId, TeamId } from './ids';
import { kaderDesTeams, kinderImKader } from './kinder-im-kader';
import type { Spiel } from './spiel';
import type { Spielbericht } from './spielbericht';

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

/** The one read the search makes. */
type SpielberichtLesen<O extends ReadOptions> = Pick<
  BasketballData<O>,
  'spielbericht'
>;

/** One Spiel's read: the Kinder its Kader named, or that it failed. */
type Lesen =
  | { readonly gelesen: true; readonly kinder: KinderImKader | undefined }
  | { readonly gelesen: false };

/** How many Spielberichte of one Team the search reads side by side. */
const ZUGLEICH = 2;

/**
 * Looks for `auftrag.kinder` in the Team's own Kader of its Spiele, never
 * anywhere else (ADR 0019). Reads the newest Spiel alone, which mostly
 * names every Kind already, then the others `ZUGLEICH` at a time, newest
 * first, and stops once each Kind was found. A Spielbericht the DBB does
 * not know counts as none yet; a read that fails otherwise (offline, the
 * DBB down) leaves the search `unvollstaendig` and ends it after its batch.
 * `options` go to every read as they are; a cancelled read ends the search.
 */
export async function kaderSuchen<O extends ReadOptions>(
  data: SpielberichtLesen<O>,
  auftrag: KaderSucheAuftrag,
  options?: O
): Promise<KaderFunde> {
  const spiele = new Map<SpielId, KinderImKader | undefined>();
  const offen = new Set(auftrag.kinder);
  for (const stapel of stapelVon(auftrag.spiele)) {
    if (offen.size === 0) {
      break;
    }
    const gelesen = await Promise.all(
      stapel.map((spiel) => kinderIn(data, auftrag, spiel, options))
    );
    gelesen.forEach((lesen, i) => {
      if (lesen.gelesen) {
        spiele.set(stapel[i].id, lesen.kinder);
        lesen.kinder?.forEach((_vorname, person) => offen.delete(person));
      }
    });
    if (gelesen.some((lesen) => !lesen.gelesen)) {
      return { spiele, unvollstaendig: true };
    }
  }
  return { spiele, unvollstaendig: false };
}

/** `spiele` as the search reads them: the newest alone, then `ZUGLEICH` each. */
function stapelVon(spiele: readonly Spiel[]): readonly (readonly Spiel[])[] {
  const [neuestes, ...rest] = spiele;
  if (neuestes === undefined) {
    return [];
  }
  const stapel: Spiel[][] = [[neuestes]];
  for (let i = 0; i < rest.length; i += ZUGLEICH) {
    stapel.push(rest.slice(i, i + ZUGLEICH));
  }
  return stapel;
}

/**
 * The Kinder in the Team's Kader of `spiel`, none where it has no
 * Spielbericht (yet, or the DBB knows none); a failed read as such, unless
 * the search was cancelled, which ends it.
 */
async function kinderIn<O extends ReadOptions>(
  data: SpielberichtLesen<O>,
  auftrag: KaderSucheAuftrag,
  spiel: Spiel,
  options: O | undefined
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
