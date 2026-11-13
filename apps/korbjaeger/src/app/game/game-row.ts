import {
  outcomeOf,
  resultOf,
  resultProvisional,
  opponentOf,
  leagueOf,
  participantName,
  sideOf,
  irregularityOf,
  type Game,
  type GameOutcome,
  type GameIrregularity,
  type TeamSeason,
} from '@wolsok/feat-shared-basketball-data';
import { resultText, gameDay } from './game-format';

/** One Spiel seen from a Team, as the screens show it (`GameRowComponent`). */
export interface GameRow {
  readonly id: number;
  /** The day, e.g. `Sa., 29.08.2026`. */
  readonly date: string;
  /** The tip-off, `HH:mm`; absent where the DBB has none. */
  readonly time?: string;
  readonly league: string;
  /** Absent where the DBB lists the Team on neither side. */
  readonly homeOrAway?: 'Heim' | 'Auswärts';
  /** The opponent, or both sides where `homeOrAway` is absent. */
  readonly opponent: string;
  /** The points, home first (`78:47`), once there are any. */
  readonly result?: string;
  /** How it ended for the Team, once decided (as its score shows it, confirmed or not). */
  readonly outcome?: GameOutcome;
  /** Whether score and `outcome` may still change (`resultProvisional`). */
  readonly provisional: boolean;
  readonly irregularity?: GameIrregularity;
}

/** Every Spiel of `season`, across its Ligen, in the port's date order. */
export function gameRows(season: TeamSeason): readonly GameRow[] {
  return season.games.map((game) => gameRow(season, game));
}

/** `game` of `season` as a line, seen from the Saison's Team. */
export function gameRow(season: TeamSeason, game: Game): GameRow {
  const side = sideOf(game, season.team.id);
  const result = resultOf(game);
  const league = leagueOf(season, game.leagueId);
  return {
    id: game.id,
    date: gameDay(game.date),
    time: game.time,
    league: league?.name ?? '',
    homeOrAway: side && HOME_OR_AWAY[side],
    opponent: side
      ? participantName(opponentOf(game, side))
      : `${participantName(game.home)} – ${participantName(game.away)}`,
    result: result && resultText(result),
    outcome: side && outcomeOf(game, side),
    provisional: resultProvisional(game, league),
    irregularity: irregularityOf(game),
  };
}

const HOME_OR_AWAY = { home: 'Heim', away: 'Auswärts' } as const;
