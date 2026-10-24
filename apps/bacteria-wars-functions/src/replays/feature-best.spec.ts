import { Timestamp } from 'firebase-admin/firestore';
import type { Account } from '../accounts';
import type { Engine } from '../engine';
import {
  isCandidate,
  MAX_CANDIDATES,
  pickPublished,
  rankCandidates,
  StoredReplay,
} from './feature-best';
import type { ReplayDoc } from './model';

const NOW = Date.UTC(2026, 9, 24, 3);
const DAY = 86_400_000;
/** Any balance: the gallery compares it with the engine's, whatever it is. */
const BALANCE = 5 as number as Engine['BALANCE_VERSION'];

function replay(id: string, doc: Partial<ReplayDoc> = {}): StoredReplay {
  return {
    id,
    doc: {
      players: ['ana'],
      kind: 'computer',
      levelId: 'quarantine',
      difficulty: 'hard',
      balanceVersion: BALANCE,
      replayVersion: 2,
      createdAt: Timestamp.fromMillis(NOW - DAY / 2),
      ticks: 3 * 60 * 60,
      endedBy: 'annihilation',
      winnerSeat: 0,
      hint: 50,
      state: 'submitted',
      optOut: [],
      ...doc,
    },
  };
}

function account(uid: string, extra: Partial<Account> = {}): [string, Account] {
  return [
    uid,
    {
      uid,
      anonymous: false,
      createdAt: NOW - 30 * DAY,
      admin: false,
      ...extra,
    },
  ];
}

const accounts = new Map([account('ana'), account('bob')]);
const online = (id: string, extra: Partial<ReplayDoc> = {}) =>
  replay(id, {
    kind: 'online',
    state: 'agreed',
    players: ['ana', 'bob'],
    room: { code: 'ABCDEF', n: 1, host: 'ana', guest: 'bob', createdAt: null },
    bound: true,
    ...extra,
  });

describe('isCandidate', () => {
  const candidate = (
    stored: StoredReplay,
    found = accounts,
    out = new Set<string>()
  ) =>
    isCandidate(
      stored,
      { BALANCE_VERSION: BALANCE, TICKS_PER_SEC: 60 },
      found,
      out,
      NOW
    );

  it('takes a submitted local match and an agreed online one', () => {
    expect(candidate(replay('l_1'))).toBe(true);
    expect(candidate(online('o_1'))).toBe(true);
    expect(candidate(replay('l_2', { state: 'verified' }))).toBe(true);
  });

  it.each([
    ['another balance', replay('l', { balanceVersion: BALANCE - 1 })],
    ['a match over 6 minutes', replay('l', { ticks: 7 * 60 * 60 })],
    ['a match taken down', replay('l', { optOut: ['ana'] })],
    ['an unverified one', replay('l', { state: 'unverified' })],
    ['an online match waiting for a report', online('o', { state: 'waiting' })],
    ['a disputed one', online('o', { state: 'disputed' })],
    ['an online match its room did not bind', online('o', { bound: false })],
    [
      'an online match of one account',
      online('o', { players: ['ana', 'ana'] }),
    ],
  ])('refuses %s', (_, stored) => {
    expect(candidate(stored)).toBe(false);
  });

  it('refuses guests, young accounts and players who opted out', () => {
    const guest = new Map([account('ana', { anonymous: true })]);
    const young = new Map([account('ana', { createdAt: NOW - 2 * DAY })]);
    expect(candidate(replay('l'), guest)).toBe(false);
    expect(candidate(replay('l'), young)).toBe(false);
    expect(candidate(replay('l'), new Map())).toBe(false);
    expect(candidate(replay('l'), accounts, new Set(['ana']))).toBe(false);
    expect(candidate(online('o'), accounts, new Set(['bob']))).toBe(false);
  });
});

describe('rankCandidates', () => {
  it('takes the best hints, three per player, twenty in all', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      replay(`l_${i}`, { players: [`p${i % 10}`], hint: i })
    );
    const ranked = rankCandidates([
      ...many,
      replay('l_ana1', { hint: 99 }),
      replay('l_ana2', { hint: 98 }),
      replay('l_ana3', { hint: 97 }),
      replay('l_ana4', { hint: 96 }),
    ]);
    expect(ranked).toHaveLength(MAX_CANDIDATES);
    expect(ranked.slice(0, 3).map(({ id }) => id)).toEqual([
      'l_ana1',
      'l_ana2',
      'l_ana3',
    ]);
    expect(ranked.map(({ id }) => id)).not.toContain('l_ana4');
  });
});

describe('pickPublished', () => {
  const verified = (id: string, extra: Partial<ReplayDoc>) =>
    replay(id, { state: 'verified', score: 70, ...extra });

  it('publishes scores of 60 and more, online matches first', () => {
    expect(
      pickPublished([
        verified('l_low', { players: ['c'], score: 59 }),
        verified('l_high', { players: ['d'], score: 95 }),
        {
          ...online('o_1'),
          doc: { ...online('o_1').doc, state: 'verified', score: 61 },
        },
      ])
    ).toEqual(['o_1', 'l_high']);
  });

  it('takes one per player and two per level', () => {
    expect(
      pickPublished([
        verified('l_1', { players: ['a'], score: 90 }),
        verified('l_2', { players: ['a'], score: 89, levelId: 'other' }),
        verified('l_3', { players: ['b'], score: 88 }),
        verified('l_4', { players: ['c'], score: 87 }),
        verified('l_5', { players: ['d'], score: 86, levelId: 'other' }),
      ])
    ).toEqual(['l_1', 'l_3', 'l_5']);
  });

  it('publishes ten at most', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      verified(`l_${i}`, { players: [`p${i}`], levelId: `level-${i}` })
    );
    expect(pickPublished(many)).toHaveLength(10);
  });
});
