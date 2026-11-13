import type { Resource } from '@angular/core';
import {
  participantName,
  type Roster,
  type GameDetails,
  type GameSide,
  type GameReport,
  type TeamId,
} from '@wolsok/feat-shared-basketball-data';
import { isFollowed } from './followed-club';
import { errorText, NO_GAME } from '../errors/error-text';

/** One Kader with what heads it on the page. */
export interface RosterPart {
  readonly side: GameSide;
  /** The Team's name, or its side while the Spiel cannot be read. */
  readonly title: string;
  readonly roster: Roster;
  /**
   * Whether the Team of this side is one of Meine Teams: only there can a
   * Kind be marked and is it highlighted (ADR 0019).
   */
  readonly followed: boolean;
}

/** What the Spiel page shows of the Spielbericht. */
export type GameReportPart =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly text: string }
  | { readonly kind: 'missing'; readonly text: string }
  | {
      readonly kind: 'ready';
      readonly rosters: readonly [RosterPart, RosterPart];
    };

/** What the page calls a Kader's side while the Spiel cannot be read. */
const SIDE_LABEL: Readonly<Record<GameSide, string>> = {
  home: 'Heim',
  away: 'Gast',
};

/**
 * The Spielbericht part of the page, from its read (`report`) and the
 * Spiel's (`game`), which names the Kader and tells whose Team is one of
 * Meine Teams (`followed`, none while they are not read). `undefined` where
 * the Spielbericht failed with the Spiel: the page's alert says why, once.
 */
export function gameReportPart(
  report: Resource<GameReport | undefined>,
  game: Resource<GameDetails | undefined>,
  followed: readonly TeamId[] = []
): GameReportPart | undefined {
  const details = game.hasValue() ? game.value() : undefined;
  switch (report.status()) {
    case 'error':
      return game.status() === 'error'
        ? undefined
        : {
            kind: 'error',
            text: errorText(report.error(), NO_GAME) ?? '',
          };
    case 'resolved':
    case 'local': {
      const read = report.value();
      return read === undefined
        ? { kind: 'missing', text: missingText(details) }
        : {
            kind: 'ready',
            rosters: [
              part('home', read, details, followed),
              part('away', read, details, followed),
            ],
          };
    }
    default:
      return { kind: 'loading' };
  }
}

function part(
  side: GameSide,
  report: GameReport,
  details: GameDetails | undefined,
  followed: readonly TeamId[]
): RosterPart {
  const participant = details?.game[side];
  return {
    side,
    title: participant ? participantName(participant) : SIDE_LABEL[side],
    roster: report[side],
    followed: participant !== undefined && isFollowed(participant, followed),
  };
}

/**
 * Why there is no Spielbericht: none for a Spiel off, none in a Liga the
 * DBB keeps none for, else one to come.
 */
function missingText(details: GameDetails | undefined): string {
  if (details?.game.status.kind === 'cancelled') {
    return 'Das Spiel fällt aus, einen Spielbericht gibt es nicht.';
  }
  return details?.league.withoutGameReports
    ? 'Für diese Liga führt der DBB keine Spielberichte, Kader und Viertel gibt es hier nicht.'
    : 'Noch kein Spielbericht. Schau später noch einmal vorbei.';
}
