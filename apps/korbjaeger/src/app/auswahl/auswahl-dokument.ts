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
 * Tells what `gelesen`, a stored document, is. A document without a valid
 * list of Teams is none; one whose Kinder cannot be read (missing, as
 * before Kinder joined, or malformed) keeps its Teams and has no Kinder.
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
  if (version !== AUSWAHL_VERSION || !sindTeamIds(teams)) {
    return KEINS;
  }
  return {
    art: 'aktuell',
    teams: [...new Set(teams)],
    kinder: sindKinder(kinder) ? jedesKindEinmal(kinder) : [],
    roh,
  };
}

/**
 * The document to store for `inhalt`: `roh`, the fields read before, with
 * this version, the Teams and the Kinder, so fields a later version added
 * stay.
 */
export function auswahlDokumentMit(
  inhalt: AuswahlInhalt,
  roh: RohesDokument = {}
): RohesDokument {
  const dokument: AuswahlDokument = {
    version: AUSWAHL_VERSION,
    teams: inhalt.teams,
    kinder: inhalt.kinder.map(({ personId, spitzname }) =>
      kindMit(personId, spitzname)
    ),
  };
  return { ...roh, ...dokument };
}

function sindTeamIds(teams: unknown): teams is readonly TeamId[] {
  return (
    Array.isArray(teams) &&
    teams.every((team) => typeof team === 'number' && isDbbId(team))
  );
}

function sindKinder(kinder: unknown): kinder is readonly Kind[] {
  return Array.isArray(kinder) && kinder.every(istKind);
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
