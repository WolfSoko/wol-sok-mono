import { BehaviorSubject } from 'rxjs';
import {
  holdingBan,
  holdingBans,
  parseBan,
  parseNotice,
  type PlayerBan,
} from './game-moderation';

const at = (ms: number) => ({ toMillis: () => ms });

describe('parseBan', () => {
  it("reads the browser's Timestamps in whole ms", () => {
    expect(
      parseBan({ since: at(10.6), until: at(500.2), reason: 'spam' })
    ).toEqual({ since: 10, until: 500, reason: 'spam' });
  });

  it('reads ms as well, as older documents hold them', () => {
    expect(parseBan({ since: 10, until: 500, reason: 'spam' })?.until).toBe(
      500
    );
  });
});

describe('holdingBan', () => {
  const stored: PlayerBan = { since: 0, until: 100, reason: 'cheating' };
  const mirror: PlayerBan = { since: null, until: 200, reason: null };

  it('takes the stored ban, which says why, while it holds', () => {
    expect(holdingBan(stored, mirror, 50)).toBe(stored);
  });

  it('falls back to the mirror while only it holds', () => {
    expect(holdingBan(null, mirror, 50)).toBe(mirror);
    expect(holdingBan(stored, mirror, 150)).toBe(mirror);
    expect(holdingBan(stored, mirror, 250)).toBeNull();
  });
});

describe('holdingBans', () => {
  beforeEach(() => jest.useFakeTimers({ now: 0 }));
  afterEach(() => jest.useRealTimers());

  it('ends a ban by itself at its until', () => {
    const stored = new BehaviorSubject<PlayerBan | null>({
      since: 0,
      until: 1_000,
      reason: 'spam',
    });
    const seen: (PlayerBan | null)[] = [];
    const subscription = holdingBans(
      stored,
      new BehaviorSubject<PlayerBan | null>(null)
    ).subscribe((ban) => seen.push(ban));

    expect(seen).toEqual([{ since: 0, until: 1_000, reason: 'spam' }]);
    jest.advanceTimersByTime(999);
    expect(seen).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(seen.at(-1)).toBeNull();
    subscription.unsubscribe();
  });

  it('waits out a ban longer than a browser timer in steps', () => {
    const month = 30 * 86_400_000;
    const seen: (PlayerBan | null)[] = [];
    const subscription = holdingBans(
      new BehaviorSubject<PlayerBan | null>({
        since: 0,
        until: month,
        reason: 'other',
      }),
      new BehaviorSubject<PlayerBan | null>(null)
    ).subscribe((ban) => seen.push(ban));

    jest.advanceTimersByTime(2_147_483_647);
    expect(seen).toHaveLength(1);
    jest.advanceTimersByTime(month - 2_147_483_647);
    expect(seen.at(-1)).toBeNull();
    subscription.unsubscribe();
  });

  it('follows the stored ban and the mirror as they change', () => {
    const stored = new BehaviorSubject<PlayerBan | null>(null);
    const mirror = new BehaviorSubject<PlayerBan | null>(null);
    const seen: (PlayerBan | null)[] = [];
    const subscription = holdingBans(stored, mirror).subscribe((ban) =>
      seen.push(ban)
    );

    mirror.next({ since: null, until: null, reason: null });
    stored.next({ since: 0, until: null, reason: 'spam' });
    stored.next(null);
    mirror.next(null);

    expect(
      seen.map((ban) => ban?.reason ?? (ban === null ? 'none' : '?'))
    ).toEqual(['none', '?', 'spam', '?', 'none']);
    subscription.unsubscribe();
  });
});

describe('parseNotice', () => {
  it('reads a ban notice with its end and reason', () => {
    expect(
      parseNotice('n1', {
        type: 'banned',
        at: at(5),
        until: null,
        reason: 'offensive-profile',
        expireAt: at(9),
      })
    ).toEqual({
      id: 'n1',
      type: 'banned',
      at: 5,
      until: null,
      reason: 'offensive-profile',
    });
  });

  it('keeps only type and time of any other notice', () => {
    expect(
      parseNotice('n2', { type: 'image-removed', at: at(7), reason: 'spam' })
    ).toEqual({ id: 'n2', type: 'image-removed', at: 7 });
  });

  it('reads nothing it does not know', () => {
    expect(parseNotice('n3', { type: 'promoted', at: at(1) })).toBeNull();
    expect(parseNotice('n4', { type: 'unbanned' })).toBeNull();
  });
});
