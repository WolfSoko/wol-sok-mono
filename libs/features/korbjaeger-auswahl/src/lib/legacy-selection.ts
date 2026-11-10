import { AUSWAHL_VERSION } from './auswahl-dokument';
import { istId, istKarte, type RohesDokument } from './selection-entries';

/** The versions before #2966, with German fields. */
const LEGACY_VERSIONS: readonly unknown[] = [1, 2];

/**
 * `raw`, a selection of version 1 or 2 (German fields: `kinder` with
 * `seit` and `spitzname`, `vereinsfarben`), as a document of this version
 * (`AuswahlDokument`), for `auswahlDokumentLesen` to read; `undefined` where
 * it is none of those versions. Version 1's lists become maps, each entry
 * counting 1, 2, 3 … in the list's order (a person listed twice once); a
 * list of Teams that are not all ids stays one, so the reader takes the
 * document for none, as before. Only the migration reads it.
 */
export function legacySelection(raw: unknown): RohesDokument | undefined {
  if (!istKarte(raw) || !LEGACY_VERSIONS.includes(raw['version'])) {
    return undefined;
  }
  const { teams, kinder, vereinsfarben } = raw;
  return {
    version: AUSWAHL_VERSION,
    ...(teams !== undefined && { teams: legacyTeams(teams) }),
    ...(kinder !== undefined && { children: legacyChildren(kinder) }),
    ...(vereinsfarben !== undefined && { clubColors: vereinsfarben }),
  };
}

function legacyTeams(teams: unknown): unknown {
  if (!Array.isArray(teams) || !teams.every(istId)) {
    return teams;
  }
  return Object.fromEntries(
    [...new Set(teams)].map((team, index) => [team, index + 1])
  );
}

function legacyChildren(kinder: unknown): unknown {
  if (Array.isArray(kinder)) {
    return legacyChildList(kinder);
  }
  if (!istKarte(kinder)) {
    return kinder;
  }
  return Object.fromEntries(
    Object.entries(kinder).map(([personId, entry]) => [
      personId,
      istKarte(entry) ? legacyChild(entry['seit'], entry['spitzname']) : entry,
    ])
  );
}

/** Version 1's list of `{ personId, spitzname? }`, its unreadable entries left out. */
function legacyChildList(kinder: readonly unknown[]): RohesDokument {
  const children: Record<string, RohesDokument> = {};
  for (const entry of kinder) {
    if (
      istKarte(entry) &&
      istId(entry['personId']) &&
      children[entry['personId']] === undefined
    ) {
      children[entry['personId']] = legacyChild(
        Object.keys(children).length + 1,
        entry['spitzname']
      );
    }
  }
  return children;
}

function legacyChild(since: unknown, nickname: unknown): RohesDokument {
  return { since, ...(nickname !== undefined && { nickname }) };
}
