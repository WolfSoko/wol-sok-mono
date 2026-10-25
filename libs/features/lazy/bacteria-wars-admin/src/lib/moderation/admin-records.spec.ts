import {
  banHolds,
  millisOf,
  parseAudit,
  parseBan,
  parseEntry,
  parseMember,
  parseModeration,
  parseProfileFlags,
} from './admin-records';

const at = (millis: number) => ({ toMillis: () => millis });

describe('admin records', () => {
  it('reads Timestamps and numbers as ms', () => {
    expect(millisOf(at(5))).toBe(5);
    expect(millisOf(7)).toBe(7);
    expect(millisOf('7')).toBeNull();
    expect(millisOf(Number.NaN)).toBeNull();
  });

  it('reads a ban, for good or until a moment', () => {
    expect(
      parseBan('ada', { since: at(1), until: at(9), reason: 'spam' })
    ).toEqual({ uid: 'ada', since: 1, until: 9, reason: 'spam' });
    expect(
      parseBan('ada', { since: at(1), until: null, reason: 'cheating' })
    ).toEqual({ uid: 'ada', since: 1, until: null, reason: 'cheating' });
    expect(parseBan('ada', { since: at(1), reason: 'spam' })).toBeNull();
    expect(
      parseBan('ada', { since: at(1), until: null, reason: 'rude' })
    ).toBeNull();
    expect(parseBan('ada', undefined)).toBeNull();
  });

  it('tells whether a ban still holds', () => {
    const ban = { uid: 'ada', since: 1, reason: 'spam' as const };
    expect(banHolds({ ...ban, until: null }, 100)).toBe(true);
    expect(banHolds({ ...ban, until: 101 }, 100)).toBe(true);
    expect(banHolds({ ...ban, until: 100 }, 100)).toBe(false);
  });

  it('reads the entries a membership points to, and the kinds barred', () => {
    expect(
      parseMember({
        boards: ['xp', 'daily-2026-10-25', 'nonsense', 'endless'],
        entryIds: { xp: 'x1', daily: 'd1', online: 'o1' },
        barred: ['daily', 'bogus'],
        activeAt: at(3),
      })
    ).toEqual({
      entries: [
        { boardId: 'xp', kind: 'xp', entryId: 'x1' },
        { boardId: 'daily-2026-10-25', kind: 'daily', entryId: 'd1' },
      ],
      barred: ['daily'],
      activeAt: 3,
    });
    expect(parseMember(undefined)).toEqual({
      entries: [],
      barred: [],
      activeAt: null,
    });
  });

  it('reads an entry and why it is hidden', () => {
    expect(
      parseEntry({
        status: 'hidden',
        hiddenBy: { admin: true, ban: false, other: true },
        name: null,
        sort: 12,
      })
    ).toEqual({ status: 'hidden', hiddenBy: ['admin'], name: null, sort: 12 });
    expect(parseEntry({ status: 'odd' })).toEqual({
      status: null,
      hiddenBy: [],
      name: null,
      sort: null,
    });
    expect(parseEntry(undefined)).toBeNull();
  });

  it('counts the moderation, zero for what is missing', () => {
    expect(parseModeration({ bans: 2, hides: 'x' })).toEqual({
      resets: 0,
      imageRemovals: 0,
      hides: 0,
      bans: 2,
    });
  });

  it('reads the flags of a profile', () => {
    expect(parseProfileFlags({ publicName: true, boardOptOut: 1 })).toEqual({
      publicName: true,
      boardOptOut: false,
      galleryOptOut: false,
    });
  });

  it('reads an audit entry', () => {
    expect(
      parseAudit('c1', {
        at: at(4),
        by: 'own',
        type: 'board.hideEntry',
        target: { uid: 'ada', boardId: 'xp', entryId: 'x1' },
        reason: 'rude name',
        ok: false,
        error: 'not-on-board',
        before: null,
      })
    ).toEqual({
      id: 'c1',
      at: 4,
      by: 'own',
      type: 'board.hideEntry',
      uid: 'ada',
      entry: { boardId: 'xp', entryId: 'x1' },
      reason: 'rude name',
      ok: false,
      error: 'not-on-board',
      before: null,
      after: null,
    });
    expect(
      parseAudit('c2', { type: 'stats.refresh', target: null, ok: null })
    ).toMatchObject({ uid: null, entry: null, ok: null, reason: '' });
    expect(parseAudit('c3', { by: 'own' })).toBeNull();
  });
});
