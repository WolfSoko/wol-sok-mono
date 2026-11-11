import {
  lastWithGameReport,
  withoutAnyGameReports,
  type GameId,
  type TeamSeason,
} from '@wolsok/feat-shared-basketball-data';

/**
 * What a followed Team offers to mark the Elternteil's Kind: its last
 * played Spiel with a Spielbericht, whose Kader names the players; none
 * where every Spiel of its Saison is in a Liga the DBB keeps no
 * Spielberichte for; or nothing yet before such a Spiel was played.
 */
export type ChildStep =
  | { readonly kind: 'mark'; readonly spielId: GameId }
  | { readonly kind: 'no-game-reports' }
  | { readonly kind: 'after-first-game' };

/**
 * The step for `saison` on `heute`: the last Spiel played up to today in a
 * Liga with Spielberichte (`lastWithGameReport`), else why there is none.
 *
 * @param heute a German calendar day, `YYYY-MM-DD` (`dateInGermany`)
 */
export function childStep(saison: TeamSeason, heute: string): ChildStep {
  const last = lastWithGameReport(saison, heute);
  if (last) {
    return { kind: 'mark', spielId: last.id };
  }
  return withoutAnyGameReports(saison)
    ? { kind: 'no-game-reports' }
    : { kind: 'after-first-game' };
}
