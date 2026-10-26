import { forgetChanges, stillRanking } from './forget-plan';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 26, 12);

describe('forgetChanges', () => {
  it('takes the player out of a local match', () => {
    expect(
      forgetChanges(
        {
          players: ['ada'],
          optOut: ['ada'],
          expireAt: 'kept',
          createdAt: NOW - DAY,
        },
        'ada',
        NOW
      )
    ).toEqual({ players: [], optOut: [] });
  });

  it("keeps the other player's seat of an online match", () => {
    expect(
      forgetChanges(
        {
          players: ['ada', 'bob'],
          optOut: [],
          seats: ['ada', 'bob'],
          expireAt: 'kept',
          createdAt: NOW,
        },
        'ada',
        NOW
      )
    ).toEqual({ players: ['bob'], optOut: [], seats: [null, 'bob'] });
  });

  it('finds the player in a seat alone', () => {
    expect(
      forgetChanges(
        {
          players: ['bob'],
          seats: ['bob', 'ada'],
          expireAt: 'kept',
          createdAt: NOW,
        },
        'ada',
        NOW
      )
    ).toEqual({ players: ['bob'], optOut: [], seats: ['bob', null] });
  });

  it('is null for a replay that does not name the player', () => {
    expect(
      forgetChanges(
        { players: ['bob'], seats: ['bob', null], createdAt: NOW },
        'ada',
        NOW
      )
    ).toBeNull();
  });

  it('gives a replay without an expiry its 30 days back, at least a day from now', () => {
    expect(
      forgetChanges({ players: ['ada'], createdAt: NOW - DAY }, 'ada', NOW)
    ).toMatchObject({ expireAt: NOW + 29 * DAY });
    expect(
      forgetChanges({ players: ['ada'], createdAt: NOW - 40 * DAY }, 'ada', NOW)
    ).toMatchObject({ expireAt: NOW + DAY });
  });

  it('keeps a replay that is still public without an expiry', () => {
    // TTL would delete it under its public copy; `takeDownPublic` gives it
    // its expiry back once the copy comes down.
    expect(
      forgetChanges(
        { players: ['ada'], publicId: 'p1', createdAt: NOW - DAY },
        'ada',
        NOW
      )
    ).toEqual({ players: [], optOut: [] });
  });
});

describe('stillRanking', () => {
  const fresh = NOW - HOUR;

  it('holds for an attempt or an agreed online match not answered yet', () => {
    expect(stillRanking({ attempt: { id: 'x' }, createdAt: fresh }, NOW)).toBe(
      true
    );
    expect(
      stillRanking({ kind: 'online', state: 'agreed', createdAt: fresh }, NOW)
    ).toBe(true);
  });

  it('ends with the answer, or once the ranking stopped trying', () => {
    expect(
      stillRanking(
        { attempt: { id: 'x' }, rankedReason: 'counted', createdAt: fresh },
        NOW
      )
    ).toBe(false);
    expect(
      stillRanking({ attempt: { id: 'x' }, createdAt: NOW - 4 * HOUR }, NOW)
    ).toBe(false);
  });

  it('holds for an online match waiting for its second report until the sweep closes it', () => {
    const waiting = {
      kind: 'online',
      state: 'waiting',
      closeAt: 'set',
      createdAt: NOW - 10 * HOUR,
    };
    // `closeNotReported` still answers it, however late it runs.
    expect(stillRanking(waiting, NOW)).toBe(true);
    expect(
      stillRanking({ ...waiting, rankedReason: 'not-reported' }, NOW)
    ).toBe(false);
    // Without `closeAt` no sweep ever finds it.
    expect(stillRanking({ ...waiting, closeAt: undefined }, NOW)).toBe(false);
  });

  it('holds for an online match the gallery verified before it was ranked', () => {
    expect(
      stillRanking({ kind: 'online', state: 'verified', createdAt: fresh }, NOW)
    ).toBe(true);
  });

  it('never holds for a plain or a disputed match', () => {
    expect(stillRanking({ kind: 'computer', createdAt: fresh }, NOW)).toBe(
      false
    );
    expect(
      stillRanking({ kind: 'online', state: 'disputed', createdAt: fresh }, NOW)
    ).toBe(false);
  });
});
