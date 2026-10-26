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

  it('gives a public replay its 30 days back, at least a day from now', () => {
    expect(
      forgetChanges({ players: ['ada'], createdAt: NOW - DAY }, 'ada', NOW)
    ).toMatchObject({ expireAt: NOW + 29 * DAY });
    expect(
      forgetChanges({ players: ['ada'], createdAt: NOW - 40 * DAY }, 'ada', NOW)
    ).toMatchObject({ expireAt: NOW + DAY });
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

  it('never holds for a plain match', () => {
    expect(stillRanking({ kind: 'computer', createdAt: fresh }, NOW)).toBe(
      false
    );
    expect(
      stillRanking({ kind: 'online', state: 'waiting', createdAt: fresh }, NOW)
    ).toBe(false);
  });
});
