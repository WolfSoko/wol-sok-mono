import { Timestamp } from 'firebase-admin/firestore';
import { Engine, loadEngine } from '../engine';
import {
  addBoard,
  dailyExpireAt,
  hideReason,
  labelOf,
  memberOf,
  noteHidden,
  randomId,
} from './entries';
import type { MemberDoc } from './model';

describe('board entries', () => {
  let engine: Engine;

  beforeAll(async () => {
    engine = await loadEngine();
  });

  const member = (extra: Partial<MemberDoc> = {}): MemberDoc => ({
    entryIds: { xp: 'x1', online: 'o1', daily: 'd1', endless: 'e1' },
    boards: [],
    barred: [],
    hiddenBy: {},
    ...extra,
  });

  it('gives each board kind its own random entry id', () => {
    const fresh = memberOf(undefined);
    const ids = Object.values(fresh.entryIds);
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9]{20}$/);
    }
    expect(randomId()).not.toBe(randomId());
  });

  describe('hideReason', () => {
    const standing = { banned: false, profile: undefined };

    it('shows an entry nothing hides', () => {
      expect(hideReason(member(), 'xp', 'xp', standing)).toBeNull();
    });

    it("puts the owner's hide and bar first, then a ban, then the opt-out", () => {
      const optedOut = { banned: false, profile: { boardOptOut: true } };
      const banned = { banned: true, profile: { boardOptOut: true } };
      expect(hideReason(member(), 'xp', 'xp', optedOut)).toBe('optout');
      expect(hideReason(member(), 'xp', 'xp', banned)).toBe('ban');
      expect(
        hideReason(member({ hiddenBy: { xp: 'admin' } }), 'xp', 'xp', banned)
      ).toBe('admin');
      expect(
        hideReason(member({ barred: ['online'] }), 'online', 'online', standing)
      ).toBe('admin');
    });

    it("lets a ban that hid an entry go without the owner's hide", () => {
      const hidden = member({ hiddenBy: { xp: 'ban' } });
      expect(hideReason(hidden, 'xp', 'xp', standing)).toBeNull();
      noteHidden(hidden, 'xp', null);
      expect(hidden.hiddenBy).toEqual({});
    });
  });

  describe('labelOf', () => {
    const profile = {
      name: 'Ana',
      publicName: true,
      avatar: { kind: 'preset', id: 3 },
    };

    it('shows the opted-in name and preset on a counted entry', () => {
      expect(labelOf(engine, 'abc', 'counted', null, profile)).toEqual({
        status: 'counted',
        name: 'Ana',
        tag: engine.boardTag('abc'),
        avatar: 3,
      });
    });

    it('never names a provisional, stale or hidden entry', () => {
      for (const [status, hidden] of [
        ['provisional', null],
        ['stale', null],
        ['verified', 'optout'],
      ] as const) {
        const label = labelOf(engine, 'abc', status, hidden, profile);
        expect(label.name).toBeNull();
        expect(label.avatar).toBe(engine.boardAvatar('abc'));
      }
      expect(labelOf(engine, 'abc', 'verified', 'ban', profile).status).toBe(
        'hidden'
      );
    });

    it('falls back to the label without the opt-in, or for a blocked name', () => {
      expect(
        labelOf(engine, 'abc', 'counted', null, {
          ...profile,
          publicName: false,
        }).name
      ).toBeNull();
      expect(
        labelOf(engine, 'abc', 'counted', null, {
          ...profile,
          name: 'Anonymous #1234',
        }).name
      ).toBeNull();
    });

    it('never shows an uploaded picture', () => {
      const label = labelOf(engine, 'abc', 'counted', null, {
        ...profile,
        avatar: { kind: 'image', data: 'data:image/png;base64,AA' },
      });
      expect(label.avatar).toBe(engine.boardAvatar('abc'));
    });
  });

  it('keeps daily boards in the member list as long as their TTL', () => {
    const now = Date.parse('2026-10-24T12:00:00Z');
    const kept = member({
      boards: ['xp', 'daily-2026-09-01', 'daily-2026-10-20'],
      hiddenBy: { 'daily-2026-09-01': 'admin' },
    });
    addBoard(engine, kept, 'daily-2026-10-24', now);
    expect(kept.boards).toEqual(['xp', 'daily-2026-10-20', 'daily-2026-10-24']);
    expect(kept.hiddenBy).toEqual({});
    addBoard(engine, kept, 'xp', now);
    expect(kept.boards).toHaveLength(3);
    expect(dailyExpireAt('2026-10-24')).toEqual(
      Timestamp.fromMillis(Date.parse('2026-11-25T00:00:00Z'))
    );
  });
});
