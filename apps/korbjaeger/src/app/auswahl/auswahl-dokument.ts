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

/**
 * `gelesen` as an `AuswahlDokument`, or `undefined` where it is none: of
 * another version, or with a Team that is no DBB id.
 */
export function auswahlDokumentAus(
  gelesen: unknown
): AuswahlDokument | undefined {
  if (typeof gelesen !== 'object' || gelesen === null) {
    return undefined;
  }
  const { version, teams } = gelesen as Record<string, unknown>;
  if (version !== AUSWAHL_VERSION || !sindTeamIds(teams)) {
    return undefined;
  }
  return { version, teams: [...new Set(teams)] };
}

function sindTeamIds(teams: unknown): teams is readonly TeamId[] {
  return (
    Array.isArray(teams) &&
    teams.every((team) => typeof team === 'number' && isDbbId(team))
  );
}
