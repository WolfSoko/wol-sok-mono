import type {
  Liga,
  LigaId,
  Spiel,
  TeamSaison,
} from '@wolsok/feat-shared-basketball-data';

/**
 * The Ligen whose Tabellen the Team page shows, current first. The current
 * Liga is the one of the Team's next Spiel (from `heute` on, today's
 * included), or of its last Spiel once the Saison has none left: a
 * Hauptrunde takes over with its first Spiel to come, while a Vorrunde with
 * a Spiel still ahead stays first. The other Ligen follow by their last
 * Spiel, newest first. Relies on the port's date order of `saison.spiele`.
 *
 * @param heute today's date, `YYYY-MM-DD`, as the DBB dates its Spiele
 */
export function tabellenLigen(
  saison: TeamSaison,
  heute: string
): readonly Liga[] {
  const aktuell = naechstesOderLetztes(saison.spiele, heute);
  if (aktuell === undefined) {
    return [];
  }
  const neuesteZuerst = [...saison.spiele]
    .reverse()
    .map(({ ligaId }) => ligaId);
  const ligen = new Map(saison.ligen.map((liga) => [liga.id, liga]));
  return [...new Set<LigaId>([aktuell.ligaId, ...neuesteZuerst])]
    .map((id) => ligen.get(id))
    .filter((liga): liga is Liga => liga !== undefined);
}

function naechstesOderLetztes(
  spiele: readonly Spiel[],
  heute: string
): Spiel | undefined {
  return spiele.find(({ datum }) => datum >= heute) ?? spiele.at(-1);
}
