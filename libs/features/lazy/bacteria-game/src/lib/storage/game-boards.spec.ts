import {
  parseBoardEntry,
  parseBoardMember,
  parseBoardTop,
} from './game-boards';

describe('stored boards', () => {
  const entry = {
    sort: 10_000_100,
    atHour: 3_600_000,
    status: 'verified',
    name: null,
    tag: 4821,
    avatar: 3,
    show: { ticks: 3500, won: true },
  };

  it('reads an entry, with what it shows by board', () => {
    expect(parseBoardEntry(entry)).toEqual(entry);
    expect(
      parseBoardEntry({ ...entry, show: { xp: 1200, rank: 'colony' } })?.show
    ).toEqual({ xp: 1200, rank: 'colony' });
    expect(
      parseBoardEntry({ ...entry, show: { w: 3, l: 1, d: 0, nr: 2 } })?.show
    ).toEqual({ w: 3, l: 1, d: 0, nr: 2 });
    expect(
      parseBoardEntry({
        ...entry,
        show: { depth: 4, seconds: 300, partial: true },
      })?.show
    ).toEqual({ depth: 4, seconds: 300, partial: true });
  });

  it("leaves out the functions' own fields", () => {
    expect(
      parseBoardEntry({
        ...entry,
        baseStatus: 'verified',
        hiddenBy: {},
        updatedAt: { seconds: 1 },
        expireAt: { seconds: 2 },
      })
    ).toEqual(entry);
  });

  it('reads nothing it cannot rank as an entry', () => {
    expect(parseBoardEntry({ ...entry, sort: '1' })).toBeNull();
    expect(parseBoardEntry({ ...entry, status: 'gone' })).toBeNull();
    expect(parseBoardEntry({ ...entry, show: {} })).toBeNull();
    expect(parseBoardEntry(null)).toBeNull();
  });

  it('reads a top document, dropping the rows it cannot read', () => {
    const top = parseBoardTop({
      board: 'daily-2026-10-24',
      day: '2026-10-24',
      cut: 10,
      rows: [
        { ...entry, entryId: 'e1', pos: 1, rank: 1 },
        { ...entry, status: 'provisional', entryId: 'e2', pos: 1 },
        { entryId: 'broken' },
      ],
      balanceVersion: 3,
      updatedAt: { seconds: 1 },
      expireAt: { seconds: 2 },
      final: true,
    });

    expect(top?.rows.map((row) => [row.entryId, row.pos, row.rank])).toEqual([
      ['e1', 1, 1],
      ['e2', 1, undefined],
    ]);
    expect(top?.cut).toBe(10);
    expect(top?.day).toBe('2026-10-24');
    expect(top?.final).toBe(true);
  });

  it('reads a board that is not final yet', () => {
    expect(parseBoardTop({ board: 'xp', cut: 0, rows: [] })).toEqual({
      board: 'xp',
      cut: 0,
      rows: [],
      balanceVersion: 0,
      final: false,
    });
    expect(parseBoardTop({ board: 'xp' })).toBeNull();
  });

  it("reads a player's membership", () => {
    expect(
      parseBoardMember({
        entryIds: { xp: 'a', daily: 'b', other: 'c' },
        boards: ['xp', 'daily-2026-10-24', 3],
        barred: ['online', 'nonsense'],
        xp: { counted: 10 },
      })
    ).toEqual({
      entryIds: { xp: 'a', daily: 'b' },
      boards: ['xp', 'daily-2026-10-24'],
      barred: ['online'],
    });
    expect(parseBoardMember({})).toEqual({
      entryIds: {},
      boards: [],
      barred: [],
    });
    expect(parseBoardMember(undefined)).toBeNull();
  });
});
