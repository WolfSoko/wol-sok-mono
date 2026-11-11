import type { RecordedStats } from '@wolsok/feat-shared-basketball-data';
import type { PlayerStatsRow } from './kader-zeilen';

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
  /** Whether the Kader records it; absent: whenever it has Spielerwerte. */
  readonly shown?: (recorded: RecordedStats) => boolean;
}

/** Every Spielerwerte column, in the DBB's order. */
const COLUMNS: readonly ColumnDefinition[] = [
  {
    id: 'playingTime',
    abbreviation: 'Min.',
    label: 'Spielzeit in Minuten',
    shown: (recorded) => recorded.playingTime,
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
    shown: (recorded) => recorded.threePointers,
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
    shown: (recorded) => recorded.rebounds,
  },
  {
    id: 'assists',
    abbreviation: 'Ass.',
    label: 'Assists',
    shown: (recorded) => recorded.assists,
  },
  {
    id: 'steals',
    abbreviation: 'BG',
    label: 'Ballgewinne',
    shown: (recorded) => recorded.steals,
  },
  {
    id: 'turnovers',
    abbreviation: 'BV',
    label: 'Ballverluste',
    shown: (recorded) => recorded.turnovers,
  },
  {
    id: 'blocks',
    abbreviation: 'Bl.',
    label: 'Blocks',
    shown: (recorded) => recorded.blocks,
  },
  { id: 'fouls', abbreviation: 'F', label: 'Fouls' },
  {
    id: 'efficiency',
    abbreviation: 'Eff.',
    label: 'Effizienz',
    shown: (recorded) => recorded.efficiency,
  },
];

/**
 * The Spielerwerte columns of a Kader that records `recorded`: points,
 * field goals, free throws and fouls always, every other only where the
 * DBB recorded it. A Kader without Spielerwerte gets none.
 */
export function statsColumns(
  playerStatsRecorded: boolean,
  recorded: RecordedStats
): readonly StatsColumn[] {
  if (!playerStatsRecorded) {
    return [];
  }
  return COLUMNS.filter(({ shown }) => shown?.(recorded) ?? true).map(
    ({ id, abbreviation, label, labelWithAttempts }) => ({
      id,
      abbreviation,
      label:
        recorded.shotAttempts && labelWithAttempts ? labelWithAttempts : label,
    })
  );
}
