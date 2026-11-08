import { isDbbId, type TeamId } from '@wolsok/feat-shared-basketball-data';

/** The version of `AuswahlDokument` this app writes. */
export const AUSWAHL_VERSION = 1;

/**
 * What an adapter stores of an `Auswahl`: ids only, never names from the
 * DBB. Versioned, so Kinder (Ticket 6) can join as a field of their own
 * without a migration.
 */
export interface AuswahlDokument {
  readonly version: typeof AUSWAHL_VERSION;
  readonly teams: readonly TeamId[];
}

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
  | {
      readonly art: 'aktuell';
      readonly dokument: AuswahlDokument;
      readonly roh: RohesDokument;
    }
  | { readonly art: 'neuer' }
  | { readonly art: 'keins' };

const KEINS: GelesenesDokument = { art: 'keins' };

/** Tells what `gelesen`, a stored document, is. */
export function auswahlDokumentLesen(gelesen: unknown): GelesenesDokument {
  if (
    typeof gelesen !== 'object' ||
    gelesen === null ||
    Array.isArray(gelesen)
  ) {
    return KEINS;
  }
  const roh = gelesen as RohesDokument;
  const { version, teams } = roh;
  if (typeof version === 'number' && version > AUSWAHL_VERSION) {
    return { art: 'neuer' };
  }
  if (version !== AUSWAHL_VERSION || !sindTeamIds(teams)) {
    return KEINS;
  }
  return {
    art: 'aktuell',
    dokument: { version, teams: [...new Set(teams)] },
    roh,
  };
}

/**
 * The document to store for `teams`: `roh`, the fields read before, with
 * this version and `teams`, so fields a later version added stay.
 */
export function auswahlDokumentMit(
  teams: readonly TeamId[],
  roh: RohesDokument = {}
): RohesDokument {
  const dokument: AuswahlDokument = { version: AUSWAHL_VERSION, teams };
  return { ...roh, ...dokument };
}

function sindTeamIds(teams: unknown): teams is readonly TeamId[] {
  return (
    Array.isArray(teams) &&
    teams.every((team) => typeof team === 'number' && isDbbId(team))
  );
}
