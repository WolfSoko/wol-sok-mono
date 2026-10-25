import { BALANCE_VERSION } from '@wolsok/feat-lazy-bac-game/engine';
import {
  fitsGallery,
  type GalleryReplay,
  isCandidate,
  MAX_GALLERY_TICKS,
  MIN_ACCOUNT_AGE_MS,
  pickPublished,
  rankCandidates,
  type Stored,
} from './candidates';

const NOW = Date.UTC(2026, 9, 26, 3);

function replay(fields: Partial<GalleryReplay> = {}): GalleryReplay {
  return {
    kind: 'computer',
    state: 'submitted',
    levelId: 'quarantine',
    balanceVersion: BALANCE_VERSION,
    ticks: 3_600,
    winnerSeat: 0,
    hint: 50,
    players: ['ada'],
    optOut: [],
    ...fields,
  };
}

const online = (fields: Partial<GalleryReplay> = {}) =>
  replay({
    kind: 'online',
    state: 'agreed',
    players: ['ada', 'bob'],
    seats: ['ada', 'bob'],
    ...fields,
  });

describe('fitsGallery', () => {
  it('takes a submitted local match, an agreed online one and one the boards verified', () => {
    expect(fitsGallery(replay())).toBe(true);
    expect(fitsGallery(online())).toBe(true);
    expect(
      fitsGallery(replay({ state: 'verified', attempt: { id: 'd' } }))
    ).toBe(true);
  });

  it('leaves out what it cannot or must not show', () => {
    for (const doc of [
      replay({ state: 'unverified' }),
      replay({ attempt: { id: 'd_2026-10-25_1' } }),
      replay({ balanceVersion: BALANCE_VERSION - 1 }),
      replay({ ticks: MAX_GALLERY_TICKS + 1 }),
      replay({ optOut: ['ada'] }),
      replay({ galleryOut: true }),
      replay({ publicId: 'p1' }),
      online({ state: 'disputed' }),
      online({ stubExpired: true }),
      online({ seats: ['ada', null] }),
      online({ seats: ['ada', 'ada'] }),
      online({ players: ['ada'] }),
    ]) {
      expect(fitsGallery(doc)).toBe(false);
    }
  });
});

describe('isCandidate', () => {
  const old = { createdAt: NOW - MIN_ACCOUNT_AGE_MS, google: true };
  const accounts = new Map([
    ['ada', old],
    ['bob', old],
    ['guest', { createdAt: NOW - MIN_ACCOUNT_AGE_MS, google: false }],
    ['new', { createdAt: NOW - MIN_ACCOUNT_AGE_MS + 1, google: true }],
  ]);

  it('wants every human on a Google account a week old that stays in the gallery', () => {
    expect(isCandidate(online(), accounts, new Set(), NOW)).toBe(true);
    expect(isCandidate(online(), accounts, new Set(['bob']), NOW)).toBe(false);
    for (const uid of ['guest', 'new', 'unknown']) {
      expect(
        isCandidate(replay({ players: [uid] }), accounts, new Set(), NOW)
      ).toBe(false);
    }
  });
});

describe('rankCandidates', () => {
  it('takes the best hints first, three per player and twenty in all', () => {
    const many: Stored[] = Array.from({ length: 30 }, (_, i) => ({
      id: `r${String(i).padStart(2, '0')}`,
      doc: replay({ hint: i, players: [i >= 20 ? 'ada' : `p${i}`] }),
    }));
    const ranked = rankCandidates(many);
    expect(ranked).toHaveLength(20);
    expect(ranked[0].id).toBe('r29');
    expect(
      ranked.filter(({ doc }) => doc.players[0] === 'ada').map(({ id }) => id)
    ).toEqual(['r29', 'r28', 'r27']);
    expect(ranked.at(-1)?.id).toBe('r03');
  });
});

describe('pickPublished', () => {
  const scored = (id: string, fields: Partial<GalleryReplay>): Stored => ({
    id,
    doc: replay({ state: 'verified', score: 70, ...fields }),
  });

  it('publishes online matches first, from 60 up, one per player and two per level', () => {
    expect(
      pickPublished([
        scored('low', { score: 59, players: ['p0'] }),
        scored('local', { score: 90, players: ['p1'] }),
        scored('online', { ...online(), state: 'verified', score: 61 }),
        scored('ada-again', { score: 95, players: ['ada'], levelId: 'x' }),
        scored('third-on-level', { score: 80, players: ['p2'] }),
      ])
    ).toEqual(['online', 'local']);
  });
});
