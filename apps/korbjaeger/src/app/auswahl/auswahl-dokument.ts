import { isDbbId, type TeamId } from '@wolsok/feat-shared-basketball-data';
import { kindMit, type Kind } from './kind';

/**
 * The version of `AuswahlDokument` this app writes. Bumped only for a
 * change an older app would misread; a new field is none (Kinder joined
 * version 1 as a field of their own), since every write keeps the fields
 * it does not know. A Kind's entry holds only `personId` and `spitzname`:
 * a field added to it needs a new version, since a write rewrites it.
 */
export const AUSWAHL_VERSION = 1;

/**
 * How many Teams and Kinder an `Auswahl` holds at most: the Firestore rules
 * (`firestore.rules`) refuse more, and their spec checks these numbers.
 */
export const AUSWAHL_GRENZEN = { teams: 50, kinder: 20 } as const;

/** What an adapter stores of an `Auswahl`: ids only, never names from the DBB. */
export interface AuswahlDokument {
  readonly version: typeof AUSWAHL_VERSION;
  readonly teams: readonly TeamId[];
  readonly kinder: readonly Kind[];
}

/** What an `Auswahl` holds: Meine Teams and the marked Kinder, each once. */
export interface AuswahlInhalt {
  readonly teams: readonly TeamId[];
  readonly kinder: readonly Kind[];
}

/** An `Auswahl` that holds nothing. */
export const LEERE_AUSWAHL: AuswahlInhalt = { teams: [], kinder: [] };

/** A stored document's fields, as read. */
export type RohesDokument = Readonly<Record<string, unknown>>;

/**
 * What a stored document turned out to be:
 * - `aktuell`: this version's, with its fields as read (`roh`), which a
 *   write keeps.
 * - `neuer`: a newer version's, which this version leaves alone.
 * - `keins`: nothing, or something that is no `AuswahlDokument`.
 */
export type GelesenesDokument =
  | ({
      readonly art: 'aktuell';
      readonly roh: RohesDokument;
    } & AuswahlInhalt)
  | { readonly art: 'neuer' }
  | { readonly art: 'keins' };

const KEINS: GelesenesDokument = { art: 'keins' };

/**
 * Tells what `gelesen`, a stored document, is. Without Teams (a document
 * holding only Kinder) it has none; with Teams that are no list of ids it
 * is none. Of its Kinder it keeps each entry it can read; where the field
 * is no list (missing, as before Kinder joined, or malformed) it has none,
 * the Teams kept all the same.
 */
export function auswahlDokumentLesen(gelesen: unknown): GelesenesDokument {
  if (
    typeof gelesen !== 'object' ||
    gelesen === null ||
    Array.isArray(gelesen)
  ) {
    return KEINS;
  }
  const roh = gelesen as RohesDokument;
  const { version, teams, kinder } = roh;
  if (typeof version === 'number' && version > AUSWAHL_VERSION) {
    return { art: 'neuer' };
  }
  if (
    version !== AUSWAHL_VERSION ||
    (teams !== undefined && !sindTeamIds(teams))
  ) {
    return KEINS;
  }
  return {
    art: 'aktuell',
    teams: teams === undefined ? [] : [...new Set(teams)],
    kinder: Array.isArray(kinder)
      ? jedesKindEinmal(kinder.filter(istKind))
      : [],
    roh,
  };
}

/**
 * The document to store: `roh`, the fields read before, with this version
 * and the parts of `aenderung` given. A part left out stays as read, so a
 * change to the Teams never rewrites Kinder this version could not read,
 * and fields a later version added stay too.
 */
export function auswahlDokumentMit(
  aenderung: Partial<AuswahlInhalt>,
  roh: RohesDokument = {}
): RohesDokument {
  const { teams, kinder } = aenderung;
  return {
    ...roh,
    version: AUSWAHL_VERSION,
    ...(teams && { teams }),
    // each Kind came through `kindMit`: its person id and Spitzname only
    ...(kinder && { kinder }),
  };
}

function sindTeamIds(teams: unknown): teams is readonly TeamId[] {
  return (
    Array.isArray(teams) &&
    teams.every((team) => typeof team === 'number' && isDbbId(team))
  );
}

function istKind(kind: unknown): kind is Kind {
  if (typeof kind !== 'object' || kind === null || Array.isArray(kind)) {
    return false;
  }
  const { personId, spitzname } = kind as Readonly<Record<string, unknown>>;
  return (
    typeof personId === 'number' &&
    isDbbId(personId) &&
    (spitzname === undefined || typeof spitzname === 'string')
  );
}

/** Each Kind once, the first entry of a person kept, nicknames tidied. */
function jedesKindEinmal(kinder: readonly Kind[]): readonly Kind[] {
  const nachPerson = new Map<number, Kind>();
  for (const { personId, spitzname } of kinder) {
    if (!nachPerson.has(personId)) {
      nachPerson.set(personId, kindMit(personId, spitzname));
    }
  }
  return [...nachPerson.values()];
}
