import {
  NONE_RECORDED,
  type RecordedStats,
} from '@wolsok/feat-shared-basketball-data';
import { statsColumns } from './kader-spalten';

const EVERY_VALUE: RecordedStats = {
  playingTime: true,
  shotAttempts: true,
  threePointers: true,
  rebounds: true,
  assists: true,
  steals: true,
  turnovers: true,
  blocks: true,
  efficiency: true,
  startingFive: true,
};

describe('statsColumns', () => {
  it('gives a Kader without Spielerwerte none', () => {
    expect(statsColumns(false, EVERY_VALUE)).toEqual([]);
  });

  it('gives a youth Kader the columns it always had', () => {
    expect(statsColumns(true, NONE_RECORDED)).toEqual([
      { id: 'points', abbreviation: 'Pkt.', label: 'Punkte' },
      { id: 'fieldGoals', abbreviation: 'FK', label: 'Feldkörbe' },
      {
        id: 'freeThrows',
        abbreviation: 'FW',
        label: 'Freiwürfe getroffen von versucht',
      },
      { id: 'fouls', abbreviation: 'F', label: 'Fouls' },
    ]);
  });

  it('adds every recorded value, in the DBB order, shots made of attempted', () => {
    expect(
      statsColumns(true, EVERY_VALUE).map(
        ({ abbreviation, label }) => `${abbreviation} ${label}`
      )
    ).toEqual([
      'Min. Spielzeit in Minuten',
      'Pkt. Punkte',
      'FK Feldkörbe getroffen von versucht',
      '3P Dreier getroffen von versucht',
      'FW Freiwürfe getroffen von versucht',
      'Reb. Rebounds',
      'Ass. Assists',
      'BG Ballgewinne',
      'BV Ballverluste',
      'Bl. Blocks',
      'F Fouls',
      'Eff. Effizienz',
    ]);
  });

  it('adds only what is recorded', () => {
    expect(
      statsColumns(true, { ...NONE_RECORDED, threePointers: true }).map(
        ({ id, label }) => `${id} ${label}`
      )
    ).toEqual([
      'points Punkte',
      'fieldGoals Feldkörbe',
      'threePointers Dreier',
      'freeThrows Freiwürfe getroffen von versucht',
      'fouls Fouls',
    ]);
  });
});
