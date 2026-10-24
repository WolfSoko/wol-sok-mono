import { Engine, loadEngine } from '../engine';
import type { ReplayDoc } from '../replays/model';
import { touchesBoards } from './board-profile-changed';
import { rankReplay, touchesRanking } from './rank-replay';
import { isRelevant } from './rebuild-top';
import { dailyFinalAt, Slice } from './verification';

/** The checks the light triggers return on before they read anything. */
describe('the boards triggers', () => {
  let engine: Engine;

  beforeAll(async () => {
    engine = await loadEngine();
  });

  describe('rankReplay', () => {
    const replay = (extra: Partial<ReplayDoc> = {}) =>
      ({ state: 'submitted', players: ['ana'], ...extra }) as ReplayDoc;

    it('acts only when the state or the players changed', () => {
      expect(touchesRanking(undefined, replay())).toBe(true);
      expect(touchesRanking(replay(), replay())).toBe(false);
      expect(touchesRanking(replay(), replay({ state: 'verified' }))).toBe(
        true
      );
      expect(
        touchesRanking(replay(), replay({ players: ['ana', 'bob'] }))
      ).toBe(true);
      expect(touchesRanking(replay(), undefined)).toBe(false);
    });

    it('returns before reading anything for a write it does not act on', async () => {
      const db = {} as never;
      const accounts = async () => new Map();
      expect(
        await rankReplay(db, engine, accounts, 'l_a', replay(), replay())
      ).toBe('unchanged');
      expect(
        await rankReplay(
          db,
          engine,
          accounts,
          'l_a',
          undefined,
          replay({ kind: 'computer' })
        )
      ).toBe('nothing');
      expect(
        await rankReplay(
          db,
          engine,
          accounts,
          'o_a',
          replay({ kind: 'online', state: 'waiting' }),
          replay({ kind: 'online', state: 'disputed' })
        )
      ).toBe('nothing');
    });
  });

  describe('boardProfileChanged', () => {
    const profile = {
      name: 'Ana',
      motto: 'hi',
      publicName: true,
      avatar: { kind: 'preset', id: 1 },
    };

    it('acts on the name, publicName, boardOptOut and a preset avatar', () => {
      expect(touchesBoards(profile, { ...profile, motto: 'new' })).toBe(false);
      expect(touchesBoards(profile, { ...profile, name: 'Bo' })).toBe(true);
      expect(touchesBoards(profile, { ...profile, publicName: false })).toBe(
        true
      );
      expect(touchesBoards(profile, { ...profile, boardOptOut: true })).toBe(
        true
      );
      expect(
        touchesBoards(profile, {
          ...profile,
          avatar: { kind: 'preset', id: 2 },
        })
      ).toBe(true);
      expect(
        touchesBoards(
          { ...profile, avatar: { kind: 'image', data: 'a' } },
          { ...profile, avatar: { kind: 'image', data: 'b' } }
        )
      ).toBe(false);
    });
  });

  describe('rebuildTop', () => {
    const rows = (sorts: number[], status = 'counted') =>
      sorts.map((sort, index) => ({
        entryId: `e${index}`,
        sort,
        status: status as 'counted',
      }));
    const full = rows(Array.from({ length: 50 }, (_, i) => 1000 - i));

    it('rebuilds a board without a top, or for an entry in it', () => {
      expect(isRelevant(engine, undefined, 'x', undefined)).toBe(true);
      expect(isRelevant(engine, { cut: 0, rows: full }, 'e3', undefined)).toBe(
        true
      );
    });

    it('rebuilds for an entry that beats the last row, or while there is room', () => {
      const top = { cut: 0, rows: full };
      expect(
        isRelevant(engine, top, 'x', { sort: 951, status: 'counted' })
      ).toBe(true);
      expect(
        isRelevant(engine, top, 'x', { sort: 10, status: 'counted' })
      ).toBe(false);
      expect(
        isRelevant(engine, top, 'x', { sort: 999, status: 'hidden' })
      ).toBe(false);
      expect(
        isRelevant(engine, { cut: 0, rows: rows([5]) }, 'x', {
          sort: 1,
          status: 'counted',
        })
      ).toBe(true);
    });

    it('rebuilds for a verified entry that enters the cut below the top 50', () => {
      const top = {
        cut: 10,
        rows: rows(
          full.map((row) => row.sort),
          'provisional'
        ),
      };
      expect(
        isRelevant(engine, top, 'x', { sort: 10, status: 'verified' })
      ).toBe(true);
      expect(
        isRelevant(engine, top, 'x', { sort: 10, status: 'provisional' })
      ).toBe(false);
    });
  });

  describe('the verification slice', () => {
    it('lets each pool start one re-run, then keeps to its share', () => {
      const slice = new Slice({ daily: 100, endless: 50 }, Date.now() + 1000);
      expect(slice.poolFor('daily', 500)).toBe('daily');
      slice.spend('daily', 500);
      expect(slice.poolFor('daily', 10)).toBeNull();
      expect(slice.poolFor('endless', 40)).toBe('endless');
      slice.spend('endless', 40);
      expect(slice.poolFor('endless', 40)).toBeNull();
      expect(slice.timeLeft()).toBe(true);
    });

    it('passes unused daily budget to endless', () => {
      const slice = new Slice({ daily: 100, endless: 10 }, 0);
      slice.spend('endless', 10);
      expect(slice.poolFor('endless', 50)).toBe('daily');
      expect(slice.timeLeft()).toBe(false);
    });

    it('checks a daily board until 23:00 UTC the next day', () => {
      expect(dailyFinalAt(engine, '2026-10-24')).toBe(
        Date.parse('2026-10-25T23:00:00Z')
      );
    });
  });
});
