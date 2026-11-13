import {
  resultOf,
  resultProvisional,
  participantName,
  type Game,
  type GameDetails,
  type Participant,
  type GameSide,
  type Score,
  type TeamId,
} from '@wolsok/feat-shared-basketball-data';
import { resultText, gameDayAndTime } from '../game/game-format';

/** What a cell shows that has no value yet. */
const NO_VALUE = '–';

/** One side of a Spiel as the Spiel page names it. */
export interface GamePartner {
  readonly name: string;
  /** The Team to link to; absent for a slot the Liga fills later. */
  readonly teamId?: TeamId;
}

/** One line of the quarter scores: a side's points per period. */
export interface PeriodRow {
  readonly team: string;
  readonly points: readonly number[];
  /**
   * The side's final points, `–` while the Spiel has no result: a sum of
   * the quarters entered so far is no final score.
   */
  readonly total: string;
}

/** One period's column: its name and the short heading shown. */
export interface PeriodColumn {
  /** `1. Viertel` … `1. Verlängerung` … */
  readonly name: string;
  /** `1.` … `4.`, then `V1` … */
  readonly short: string;
}

/** The quarter scores, with a column per period. */
export interface Periods {
  readonly columns: readonly PeriodColumn[];
  readonly rows: readonly [PeriodRow, PeriodRow];
}

/** What the Spiel page shows above its Halle and Kader. */
export interface GameHead {
  readonly home: GamePartner;
  readonly away: GamePartner;
  /** E.g. `So., 20.09.2026 · 09:00 Uhr`. */
  readonly when: string;
  readonly league: string;
  /** The points, home first (`78:47`), once there are any. */
  readonly result?: string;
  /** Whether `result` awaits the Verband's confirmation. */
  readonly provisional: boolean;
  /** What became of the Spiel where it is no confirmed result. */
  readonly status?: string;
  /** Absent where the Verband records no quarters. */
  readonly periods?: Periods;
}

/** The head of the Spiel page for `details`. */
export function gameHead(details: GameDetails): GameHead {
  const { game } = details;
  const result = resultOf(game);
  const periods = periodsOf(details, result);
  const provisional = resultProvisional(game, details.league);
  const status = statusText(game, provisional);
  return {
    home: partner(game.home),
    away: partner(game.away),
    when: gameDayAndTime(game.date, game.time),
    league: details.league.name,
    ...(result && { result: resultText(result) }),
    provisional,
    ...(status && { status }),
    ...(periods && { periods }),
  };
}

function partner(participant: Participant): GamePartner {
  return participant.kind === 'team'
    ? { name: participant.team.name, teamId: participant.team.id }
    : { name: participant.label };
}

function statusText(game: Game, provisional: boolean): string | undefined {
  switch (game.status.kind) {
    case 'scheduled':
      return 'Noch kein Ergebnis';
    case 'cancelled':
      return 'abgesagt';
    case 'forfeited': {
      const forfeit = forfeitText(game, game.status.forfeitedBy);
      return forfeit === undefined ? 'kampflos' : `kampflos · ${forfeit}`;
    }
    case 'played':
      return provisional ? 'Ergebnis noch nicht bestätigt' : undefined;
  }
}

function forfeitText(
  game: Game,
  sides: readonly GameSide[]
): string | undefined {
  const names = sides.map((side) => participantName(game[side]));
  if (names.length === 0) {
    return undefined;
  }
  return names.length === 1
    ? `${names[0]} hat verzichtet`
    : `${names.join(' und ')} haben verzichtet`;
}

function periodsOf(
  { game, quarters, overtimes }: GameDetails,
  result: Score | undefined
): Periods | undefined {
  if (quarters.length === 0) {
    return undefined;
  }
  const all = [...quarters, ...overtimes];
  const row = (side: GameSide): PeriodRow => {
    const points = all.map((score) => score[side]);
    return {
      team: participantName(game[side]),
      points,
      total: result === undefined ? NO_VALUE : String(result[side]),
    };
  };
  return {
    columns: [
      ...quarters.map((_, i) => ({
        name: `${i + 1}. Viertel`,
        short: `${i + 1}.`,
      })),
      ...overtimes.map((_, i) => ({
        name: `${i + 1}. Verlängerung`,
        short: `V${i + 1}`,
      })),
    ],
    rows: [row('home'), row('away')],
  };
}
