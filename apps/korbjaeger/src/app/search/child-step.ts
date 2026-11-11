import {
  keepsGameReports,
  lastPlayed,
  type GameId,
  type TeamSeason,
} from '@wolsok/feat-shared-basketball-data';

/**
 * What a followed Team offers to mark the Elternteil's Kind: its last
 * played Spiel with a Spielbericht, whose Kader names the players; none
 * where it played only in Ligen the DBB keeps no Spielberichte for; or
 * nothing yet before its first Spiel.
 */
export type ChildStep =
  | { readonly kind: 'mark'; readonly spielId: GameId }
  | { readonly kind: 'no-game-reports' }
  | { readonly kind: 'after-first-game' };

/**
 * The step for `saison` on `heute`: the last Spiel played up to today
 * (`lastPlayed`, so a cancelled or forfeited one, which has no
 * Spielbericht, is passed over) in a Liga the DBB keeps Spielberichte for
 * (`keepsGameReports`), else why there is none.
 *
 * @param heute a German calendar day, `YYYY-MM-DD` (`dateInGermany`)
 */
export function childStep(saison: TeamSeason, heute: string): ChildStep {
  const played = lastPlayed(saison, heute, saison.games.length);
  const withReport = played.find((game) => keepsGameReports(saison, game));
  if (withReport) {
    return { kind: 'mark', spielId: withReport.id };
  }
  return played.length > 0
    ? { kind: 'no-game-reports' }
    : { kind: 'after-first-game' };
}
