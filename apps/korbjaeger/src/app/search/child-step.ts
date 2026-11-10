import {
  lastPlayed,
  type GameId,
  type TeamSeason,
} from '@wolsok/feat-shared-basketball-data';

/**
 * What a followed Team offers to mark the Elternteil's Kind: its last
 * played Spiel, whose Kader names the players, or nothing yet before its
 * first one.
 */
export type ChildStep =
  | { readonly kind: 'mark'; readonly spielId: GameId }
  | { readonly kind: 'after-first-game' };

/**
 * The step for `saison` on `heute`: the last Spiel played up to today
 * (`lastPlayed`, so a cancelled or forfeited one, which has no
 * Spielbericht, is passed over), else waiting for the first.
 *
 * @param heute a German calendar day, `YYYY-MM-DD` (`dateInGermany`)
 */
export function childStep(saison: TeamSeason, heute: string): ChildStep {
  const [last] = lastPlayed(saison, heute, 1);
  return last
    ? { kind: 'mark', spielId: last.id }
    : { kind: 'after-first-game' };
}
