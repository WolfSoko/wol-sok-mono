import {
  zuletztGespielt,
  type SpielId,
  type TeamSaison,
} from '@wolsok/feat-shared-basketball-data';

/**
 * What a followed Team offers to mark the Elternteil's Kind: its last
 * played Spiel, whose Kader names the players, or nothing yet before its
 * first one.
 */
export type ChildStep =
  | { readonly kind: 'mark'; readonly spielId: SpielId }
  | { readonly kind: 'after-first-game' };

/**
 * The step for `saison` on `heute`: the last Spiel played up to today
 * (`zuletztGespielt`, so a cancelled or forfeited one, which has no
 * Spielbericht, is passed over), else waiting for the first.
 *
 * @param heute a German calendar day, `YYYY-MM-DD` (`datumInDeutschland`)
 */
export function childStep(saison: TeamSaison, heute: string): ChildStep {
  const [last] = zuletztGespielt(saison, heute, 1);
  return last
    ? { kind: 'mark', spielId: last.id }
    : { kind: 'after-first-game' };
}
