import {
  recordedStats,
  type RecordedStats,
  type Roster,
} from '@wolsok/feat-shared-basketball-data';
import type { PlayerStatsRow } from './roster-rows';

/** A column of a player's Spielerwerte: a field of `PlayerStatsRow`. */
export type StatsColumnId = keyof PlayerStatsRow;

/** A Spielerwerte column as the Kader table heads it. */
export interface StatsColumn {
  readonly id: StatsColumnId;
  /** The short header, e.g. `Pkt.`. */
  readonly abbreviation: string;
  /** The full German name, for screen readers and the tooltip. */
  readonly label: string;
}

interface ColumnDefinition extends StatsColumn {
  /** The label where shots read made of attempted. */
  readonly labelWithAttempts?: string;
  /** The value whose recording shows it; absent: whenever it has Spielerwerte. */
  readonly recordedAs?: keyof RecordedStats;
}

/** Every Spielerwerte column, in the DBB's order. */
const COLUMNS: readonly ColumnDefinition[] = [
  {
    id: 'playingTime',
    abbreviation: 'Min.',
    label: 'Spielzeit in Minuten',
    recordedAs: 'playingTime',
  },
  { id: 'points', abbreviation: 'Pkt.', label: 'Punkte' },
  {
    id: 'fieldGoals',
    abbreviation: 'FK',
    label: 'Feldkörbe',
    labelWithAttempts: 'Feldkörbe getroffen von versucht',
  },
  {
    id: 'threePointers',
    abbreviation: '3P',
    label: 'Dreier',
    labelWithAttempts: 'Dreier getroffen von versucht',
    recordedAs: 'threePointers',
  },
  {
    id: 'freeThrows',
    abbreviation: 'FW',
    label: 'Freiwürfe getroffen von versucht',
  },
  {
    id: 'rebounds',
    abbreviation: 'Reb.',
    label: 'Rebounds',
    recordedAs: 'rebounds',
  },
  {
    id: 'assists',
    abbreviation: 'Ass.',
    label: 'Assists',
    recordedAs: 'assists',
  },
  {
    id: 'steals',
    abbreviation: 'BG',
    label: 'Ballgewinne',
    recordedAs: 'steals',
  },
  {
    id: 'turnovers',
    abbreviation: 'BV',
    label: 'Ballverluste',
    recordedAs: 'turnovers',
  },
  {
    id: 'blocks',
    abbreviation: 'Bl.',
    label: 'Blocks',
    recordedAs: 'blocks',
  },
  { id: 'fouls', abbreviation: 'F', label: 'Fouls' },
  {
    id: 'efficiency',
    abbreviation: 'Eff.',
    label: 'Effizienz',
    recordedAs: 'efficiency',
  },
];

/**
 * The Spielerwerte columns of `roster`: points, field goals, free throws
 * and fouls always, every other only where the DBB recorded it. A Kader
 * without Spielerwerte gets none.
 */
export function statsColumns(roster: Roster): readonly StatsColumn[] {
  if (!roster.playerStatsRecorded) {
    return [];
  }
  const recorded = recordedStats(roster);
  return COLUMNS.filter(
    ({ recordedAs }) => recordedAs === undefined || recorded[recordedAs]
  ).map(({ id, abbreviation, label, labelWithAttempts }) => ({
    id,
    abbreviation,
    label:
      recorded.shotAttempts && labelWithAttempts ? labelWithAttempts : label,
  }));
}
