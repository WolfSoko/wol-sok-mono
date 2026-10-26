import {
  DELETE_BATCH,
  GUEST_IDLE_MS,
  GUEST_SWEEP_LIMIT,
  type GuestRecord,
  type GuestSweepPorts,
  isIdleGuest,
  lastActiveAt,
  sweepGuests,
} from './guests';

const DAY = 24 * 3_600_000;
const NOW = Date.UTC(2026, 9, 26, 3, 41);
const time = (ms: number) => new Date(ms).toUTCString();

/** A guest last active `daysAgo` days ago, by its last refresh. */
function guest(
  uid: string,
  daysAgo: number,
  extra: Partial<GuestRecord> = {}
): GuestRecord {
  return {
    uid,
    providerData: [],
    metadata: {
      creationTime: time(NOW - 400 * DAY),
      lastSignInTime: time(NOW - 400 * DAY),
      lastRefreshTime: time(NOW - daysAgo * DAY),
    },
    ...extra,
  };
}

describe('guest accounts unused for 90 days', () => {
  it('are guests whose last refresh is over 90 days ago', () => {
    expect(GUEST_IDLE_MS).toBe(90 * DAY);
    expect(isIdleGuest(guest('old', 91), NOW)).toBe(true);
    expect(isIdleGuest(guest('fresh', 89), NOW)).toBe(false);
    expect(isIdleGuest(guest('edge', 90), NOW)).toBe(false);
  });

  it('fall back to the last sign-in, then the creation', () => {
    const noRefresh = guest('a', 0, {
      metadata: {
        creationTime: time(NOW - 200 * DAY),
        lastSignInTime: time(NOW - 10 * DAY),
        lastRefreshTime: null,
      },
    });
    expect(lastActiveAt(noRefresh)).toBe(Date.parse(time(NOW - 10 * DAY)));
    expect(isIdleGuest(noRefresh, NOW)).toBe(false);
    const created = guest('b', 0, {
      metadata: {
        creationTime: time(NOW - 100 * DAY),
        lastSignInTime: '',
      },
    });
    expect(isIdleGuest(created, NOW)).toBe(true);
    const unknown = guest('c', 0, {
      metadata: { creationTime: '', lastSignInTime: '' },
    });
    expect(lastActiveAt(unknown)).toBeNull();
    expect(isIdleGuest(unknown, NOW)).toBe(false);
  });

  it('count the latest of refresh, sign-in and creation', () => {
    // Signed in again lately, but its last refresh is old.
    const back = guest('a', 0, {
      metadata: {
        creationTime: time(NOW - 300 * DAY),
        lastSignInTime: time(NOW - 5 * DAY),
        lastRefreshTime: time(NOW - 200 * DAY),
      },
    });
    expect(lastActiveAt(back)).toBe(Date.parse(time(NOW - 5 * DAY)));
    expect(isIdleGuest(back, NOW)).toBe(false);
  });

  it('never are accounts with a provider or the admin claim', () => {
    expect(
      isIdleGuest(
        guest('google', 400, {
          providerData: [{ providerId: 'google.com', uid: 'g' }],
        }),
        NOW
      )
    ).toBe(false);
    expect(
      isIdleGuest(guest('owner', 400, { customClaims: { admin: true } }), NOW)
    ).toBe(false);
  });
});

describe('sweepGuests', () => {
  function ports(
    pages: GuestRecord[][],
    failErase: readonly string[] = []
  ): GuestSweepPorts & {
    erased: string[];
    deleted: string[][];
    pauses: number[];
    order: string[];
    uncounts: number[];
  } {
    const uncounts: number[] = [];
    const erased: string[] = [];
    const deleted: string[][] = [];
    const pauses: number[] = [];
    const order: string[] = [];
    return {
      erased,
      deleted,
      pauses,
      order,
      uncounts,
      listUsers: async (token) => {
        const i = token === undefined ? 0 : Number(token);
        return {
          users: pages[i] ?? [],
          ...(i + 1 < pages.length ? { pageToken: String(i + 1) } : {}),
        };
      },
      erase: async (uid, uncounted) => {
        // Counted, its decrement claimed - also when the rest then fails.
        uncounted();
        if (failErase.includes(uid)) {
          throw new Error('unavailable');
        }
        erased.push(uid);
        order.push(`erase ${uid}`);
      },
      deleteUsers: async (uids) => {
        deleted.push([...uids]);
        order.push(`delete ${uids.length}`);
        return { successCount: uids.length, failureCount: 0 };
      },
      pause: async (ms) => {
        pauses.push(ms);
      },
      uncount: async (by) => {
        uncounts.push(by);
        order.push(`uncount ${by}`);
      },
    };
  }

  it('erases the idle guests of every page, then deletes their accounts', async () => {
    const p = ports([
      [guest('a', 100), guest('b', 3)],
      [guest('c', 120), guest('d', 95)],
    ]);
    expect(await sweepGuests(p, NOW)).toEqual({
      listed: 4,
      idle: 3,
      failed: 0,
      deleted: 3,
      uncounted: 3,
    });
    expect(p.erased).toEqual(['a', 'c', 'd']);
    expect(p.deleted).toEqual([['a', 'c', 'd']]);
    // The data first: a bulk deletion fires no onDelete trigger.
    expect(p.order.at(-1)).toBe('delete 3');
  });

  it('lowers the account count once a batch, by the guests it erased', async () => {
    const many = Array.from({ length: DELETE_BATCH + 2 }, (_, i) =>
      guest(`g${i}`, 100)
    );
    const p = ports([many]);
    await sweepGuests(p, NOW);
    // Not once per guest: `stats/accounts` is a single document.
    expect(p.uncounts).toEqual([DELETE_BATCH, 2]);
    expect(p.order.filter((step) => !step.startsWith('erase'))).toEqual([
      `uncount ${DELETE_BATCH}`,
      `delete ${DELETE_BATCH}`,
      'uncount 2',
      'delete 2',
    ]);
  });

  it('lowers the count for a claimed decrement whose erase then failed', async () => {
    const p = ports([[guest('a', 100), guest('b', 100)]], ['a']);
    expect(await sweepGuests(p, NOW)).toMatchObject({ uncounted: 2 });
    expect(p.uncounts).toEqual([2]);
  });

  it('keeps an account whose data could not be erased, for the next run', async () => {
    const p = ports([[guest('a', 100), guest('b', 100)]], ['a']);
    expect(await sweepGuests(p, NOW)).toMatchObject({ failed: 1, deleted: 1 });
    expect(p.deleted).toEqual([['b']]);
  });

  it('deletes a thousand a call, pausing between calls, up to its limit', async () => {
    const many = Array.from({ length: GUEST_SWEEP_LIMIT + 5 }, (_, i) =>
      guest(`g${i}`, 100)
    );
    const p = ports([many.slice(0, 1000), many.slice(1000)]);
    const result = await sweepGuests(p, NOW);
    expect(result.idle).toBe(GUEST_SWEEP_LIMIT);
    expect(p.deleted.map((uids) => uids.length)).toEqual(
      Array.from(
        { length: GUEST_SWEEP_LIMIT / DELETE_BATCH },
        () => DELETE_BATCH
      )
    );
    expect(p.pauses).toHaveLength(GUEST_SWEEP_LIMIT / DELETE_BATCH - 1);
    expect(p.pauses.every((ms) => ms >= 1000)).toBe(true);
  });

  it('deletes nothing when no guest is idle', async () => {
    const p = ports([[guest('a', 1)]]);
    expect(await sweepGuests(p, NOW)).toEqual({
      listed: 1,
      idle: 0,
      failed: 0,
      deleted: 0,
      uncounted: 0,
    });
    expect(p.deleted).toEqual([]);
    expect(p.uncounts).toEqual([]);
  });
});
