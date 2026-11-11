import {
  lastPlayed,
  type GameDetails,
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
 * A `ChildStep` once the Spiel it leads to is known: none where its Liga
 * keeps no Spielberichte, so its page has no Kader to mark the Kind in.
 */
export type CheckedChildStep = ChildStep | { readonly kind: 'no-game-reports' };

/**
 * The step for `saison` on `heute`: the last Spiel played up to today
 * (`lastPlayed`, so a cancelled or forfeited one, which has no
 * Spielbericht, is passed over), else waiting for the first. Whether its
 * Liga keeps Spielberichte only its details tell (`checkedChildStep`): a
 * Team's Spiele never say.
 *
 * @param heute a German calendar day, `YYYY-MM-DD` (`dateInGermany`)
 */
export function childStep(saison: TeamSeason, heute: string): ChildStep {
  const [last] = lastPlayed(saison, heute, 1);
  return last
    ? { kind: 'mark', spielId: last.id }
    : { kind: 'after-first-game' };
}

/**
 * `step` with the `details` of the Spiel it leads to: no link where its
 * Liga keeps no Spielberichte. Details not read (yet, or of another Spiel)
 * leave the step as it is: the Spiel page says why it has no Kader.
 */
export function checkedChildStep(
  step: ChildStep,
  details: GameDetails | undefined
): CheckedChildStep {
  const ledTo = step.kind === 'mark' && details?.game.id === step.spielId;
  return ledTo && details.league.withoutGameReports
    ? { kind: 'no-game-reports' }
    : step;
}
