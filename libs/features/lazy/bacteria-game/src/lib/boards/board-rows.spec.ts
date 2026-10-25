import { BoardRow, EntryStatus } from '../state/boards';
import { boardSections, showLine } from './board-rows';

function aRow(
  entryId: string,
  sort: number,
  status: EntryStatus,
  rank?: number
): BoardRow {
  return {
    entryId,
    sort,
    atHour: 0,
    status,
    name: null,
    tag: 1000,
    avatar: 0,
    show: { ticks: 0, won: true },
    pos: 0,
    ...(rank === undefined ? {} : { rank }),
  };
}

describe('board sections', () => {
  it('puts every row of a board without a cut among the others', () => {
    const rows = [aRow('a', 3, 'counted'), aRow('b', 2, 'counted')];

    expect(boardSections(rows, 0)).toEqual({
      verified: [],
      beingChecked: [],
      others: rows,
    });
  });

  it('shows the verified places, then the claims that would rank there', () => {
    const rows = [
      aRow('claim', 9, 'provisional'),
      aRow('first', 8, 'verified', 1),
      aRow('second', 7, 'verified', 2),
      aRow('low claim', 1, 'provisional'),
    ];

    const { verified, beingChecked, others } = boardSections(rows, 2);

    expect(verified.map((row) => row.entryId)).toEqual(['first', 'second']);
    expect(beingChecked.map((row) => row.entryId)).toEqual(['claim']);
    expect(others.map((row) => row.entryId)).toEqual(['low claim']);
  });

  it('checks any claim while the verified places are not full', () => {
    const rows = [
      aRow('first', 8, 'verified', 1),
      aRow('low claim', 1, 'provisional'),
    ];

    expect(
      boardSections(rows, 10).beingChecked.map((row) => row.entryId)
    ).toEqual(['low claim']);
  });

  it('shows at most five claims as being checked', () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      aRow(`claim ${i}`, 10 - i, 'provisional')
    );

    const { beingChecked, others } = boardSections(rows, 10);

    expect(beingChecked).toHaveLength(5);
    expect(others).toHaveLength(2);
  });
});

describe('showLine', () => {
  it('tells what each board shows', () => {
    expect(showLine({ xp: 300, rank: 'coccus' }).kind).toBe('xp');
    expect(showLine({ w: 1, l: 2, d: 0, nr: 0 }).kind).toBe('online');
    expect(showLine({ ticks: 600, won: false })).toEqual({
      kind: 'daily',
      won: false,
      seconds: 10,
    });
    expect(showLine({ depth: 3, seconds: 90 })).toEqual({
      kind: 'endless',
      depth: 3,
      seconds: 90,
      partial: false,
    });
  });
});
