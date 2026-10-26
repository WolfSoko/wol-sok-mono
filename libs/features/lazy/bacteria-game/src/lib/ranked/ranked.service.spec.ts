import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { provideGameToggles } from '../../testing/fake-game-toggles';
import { FakeGameModeration } from '../../testing/fake-game-moderation';
import { FakeGameRanked } from '../../testing/fake-game-ranked';
import type { GpuSelfTestResult } from '../gl/gpu-self-test';
import { GpuSelfTestService } from '../gl/gpu-self-test.service';
import { attemptSeed } from '../state/attempts';
import { cpuSimulation } from '../state/match-engine';
import { PlayerService } from '../state/player.service';
import type { FeatureToggles } from '../state/feature-toggles';
import { GameAccount } from '../storage/game-account';
import { GameCloud } from '../storage/game-cloud';
import type { RankedRun } from '../state/ranked-match';
import { RankedService } from './ranked.service';

/** The run a ranked start came to - it must have one. */
function runOf(start: { run: RankedRun | null }): RankedRun {
  if (start.run === null) {
    throw new Error('No ranked run');
  }
  return start.run;
}

/** The line of the attempts or runs left today. */
function left(kind: 'daily' | 'endless', count: number) {
  return {
    key: `boards.ranked.left.${kind}`,
    params: { left: count, total: kind === 'daily' ? 3 : 5 },
  };
}

const NOW = Date.UTC(2026, 9, 26, 12);
const TODAY = '2026-10-26';
const TRUSTED: GpuSelfTestResult = {
  ok: true,
  renderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1)',
} as GpuSelfTestResult;

describe('RankedService', () => {
  let ranked: FakeGameRanked;
  let moderation: FakeGameModeration;
  let verdict: WritableSignal<GpuSelfTestResult | null>;

  function configure(
    options: {
      cloud?: boolean;
      toggles?: Partial<FeatureToggles>;
      gpu?: boolean;
    } = {}
  ): RankedService {
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: new FakeGameAccount('ada') },
        {
          provide: GameCloud,
          useValue: {
            ranked: () => (options.cloud === false ? null : ranked),
            moderation: () => moderation,
          },
        },
        { provide: GpuSelfTestService, useValue: { result: verdict } },
        provideGameToggles(options.toggles ?? {}),
      ],
    });
    if (options.gpu !== false) {
      TestBed.inject(PlayerService).useSimulation(
        cpuSimulation,
        cpuSimulation,
        {
          ruleset: () => 'gpu-int',
          offers: () => ['cpu', 'gpu-int'],
          gpuInt: cpuSimulation,
        }
      );
    }
    return TestBed.inject(RankedService);
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['queueMicrotask', 'nextTick'] });
    ranked = new FakeGameRanked('ada', () => Date.now());
    moderation = new FakeGameModeration();
    verdict = signal<GpuSelfTestResult | null>(TRUSTED);
  });

  afterEach(() => jest.useRealTimers());

  describe('what it offers', () => {
    it('offers ranked play on a trusted GPU, with the attempts left', async () => {
      const service = configure();
      await service.refresh();

      expect(service.offer('daily', true)).toEqual({
        on: true,
        open: true,
        lines: [
          { key: 'boards.ranked.left.daily', params: { left: 3, total: 3 } },
          { key: 'boards.ranked.setup' },
          { key: 'boards.ranked.noPause' },
        ],
      });
      expect(service.offer('endless', true)?.lines[0]).toEqual({
        key: 'boards.ranked.left.endless',
        params: { left: 5, total: 5 },
      });
    });

    it('hides it while the owner switched a mode off, and without the cloud', () => {
      expect(
        configure({ toggles: { rankedDaily: false } }).offer('daily', true)
      ).toBeNull();
      TestBed.resetTestingModule();
      expect(configure({ cloud: false }).offer('endless', true)).toBeNull();
    });

    it('offers practice when the player wants no ranked play', () => {
      expect(configure().offer('daily', false)).toEqual({
        on: false,
        open: true,
        lines: [{ key: 'boards.ranked.practice' }],
      });
    });

    it('shuts it on a device whose GPU the self-test does not trust', () => {
      verdict.set({
        ok: true,
        renderer: 'Google SwiftShader',
      } as GpuSelfTestResult);
      const service = configure();

      expect(service.offer('daily', true)).toEqual({
        on: false,
        open: false,
        lines: [{ key: 'boards.ranked.blocked.device' }],
      });
    });

    it('shuts it on a device without the integer GPU passes', () => {
      expect(configure({ gpu: false }).offer('daily', true)?.lines).toEqual([
        { key: 'boards.ranked.blocked.device' },
      ]);
    });

    it('shuts it while a ban holds', () => {
      const service = configure();
      moderation.banFor(null);

      expect(service.offer('endless', true)?.lines).toEqual([
        { key: 'boards.ranked.blocked.banned' },
      ]);
    });

    it('says when the day is used up', async () => {
      for (const n of [1, 2, 3]) {
        ranked.seed(`d_${TODAY}_${n}`);
      }
      const service = configure();
      await service.refresh();

      expect(service.offer('daily', true)).toEqual({
        on: false,
        open: false,
        lines: [{ key: 'boards.ranked.used.daily' }],
      });
    });

    it('counts a void attempt as left', async () => {
      ranked.seed(`d_${TODAY}_1`, NOW, true);
      ranked.seed(`d_${TODAY}_2`);
      const service = configure();
      await service.refresh();

      expect(service.offer('daily', true)?.lines[0]).toEqual(left('daily', 2));
    });
  });

  describe('a new UTC day', () => {
    const MIDNIGHT = Date.UTC(2026, 9, 27);

    it("offers the new day's attempts after 00:00, not the old day's count", async () => {
      for (const n of [1, 2, 3]) {
        ranked.seed(`d_${TODAY}_${n}`);
      }
      const service = configure();
      await service.refresh();
      expect(service.wants('daily', true)).toBe(false);

      jest.setSystemTime(MIDNIGHT + 60_000);

      expect(service.wants('daily', true)).toBe(true);
      const outcome = await service.declareDaily();
      expect(ranked.declarations).toEqual(['d_2026-10-27_1']);
      expect(outcome.note).toEqual({ kind: 'daily', n: 1 });
    });

    it("starts the new day's first run after 00:00", async () => {
      for (const r of [1, 2, 3, 4, 5]) {
        ranked.seed(`e_20261026${r}_0`);
      }
      const service = configure();
      await service.refresh();
      expect(service.wants('endless', true)).toBe(false);

      jest.setSystemTime(MIDNIGHT + 60_000);

      expect(service.wants('endless', true)).toBe(true);
      expect((await service.startRun()).run).toEqual({
        runId: '202610271',
        next: 1,
      });
    });
  });

  describe('reading the attempts', () => {
    it('reads once for a fresh look, then from what it read', async () => {
      const service = configure();
      const declared = jest.spyOn(ranked, 'declared');

      await service.refresh();
      await service.refresh(false);
      expect(declared).toHaveBeenCalledTimes(1);

      await service.refresh();
      expect(declared).toHaveBeenCalledTimes(2);
    });

    it('offers no count while the attempts cannot be read - not none left', async () => {
      ranked.offline = true;
      const service = configure();
      await service.refresh();

      expect(service.offer('daily', true)).toEqual({
        on: true,
        open: true,
        lines: [
          { key: 'boards.ranked.setup' },
          { key: 'boards.ranked.noPause' },
        ],
      });
    });
  });

  describe('daily attempts', () => {
    it('declares the first attempt of the day and seeds from it', async () => {
      const service = configure();
      const outcome = await service.declareDaily();

      const id = `d_${TODAY}_1`;
      expect(outcome).toEqual({
        match: { attempt: { id, at: NOW }, seed: attemptSeed('ada', id, NOW) },
        note: { kind: 'daily', n: 1 },
      });
      expect(service.offer('daily', true)?.lines[0]).toEqual(left('daily', 2));
    });

    it('declares a void attempt again first', async () => {
      ranked.seed(`d_${TODAY}_1`);
      ranked.seed(`d_${TODAY}_2`, NOW - 1, true);
      const outcome = await configure().declareDaily();

      expect(ranked.declarations).toEqual([`d_${TODAY}_2`]);
      expect(outcome.note).toEqual({ kind: 'daily', n: 2 });
    });

    it('moves on past an attempt declared meanwhile', async () => {
      const service = configure();
      await service.refresh();
      ranked.seed(`d_${TODAY}_1`);

      const outcome = await service.declareDaily();

      expect(ranked.declarations).toEqual([`d_${TODAY}_1`, `d_${TODAY}_2`]);
      expect(outcome.note).toEqual({ kind: 'daily', n: 2 });
    });

    it('plays unranked once the three are used', async () => {
      for (const n of [1, 2, 3]) {
        ranked.seed(`d_${TODAY}_${n}`);
      }

      expect(await configure().declareDaily()).toEqual({
        match: null,
        note: { kind: 'unranked', reason: 'used' },
      });
    });

    it('plays unranked when the declaration fails', async () => {
      ranked.offline = true;

      expect(await configure().declareDaily()).toEqual({
        match: null,
        note: { kind: 'unranked', reason: 'offline' },
      });
    });
  });

  describe('endless runs', () => {
    it("starts today's next run with match 0, whose seed is the run's", async () => {
      ranked.seed(`e_202610261_0`);
      const service = configure();
      const start = await service.startRun();

      const id = 'e_202610262_0';
      expect(start).toEqual({
        match: { attempt: { id, at: NOW }, seed: attemptSeed('ada', id, NOW) },
        note: { kind: 'endless', match: 1 },
        run: { runId: '202610262', next: 1 },
      });
      expect(service.offer('endless', true)?.lines[0]).toEqual(
        left('endless', 3)
      );
    });

    it('keeps a void daily attempt as left when a run starts', async () => {
      ranked.seed(`d_${TODAY}_1`, NOW, true);
      const service = configure();
      await service.startRun();

      expect(service.offer('daily', true)?.lines[0]).toEqual(left('daily', 3));
    });

    it('declares the run match by match', async () => {
      const service = configure();
      const start = await service.startRun();
      jest.setSystemTime(NOW + 60_000);
      const next = await service.declareRunMatch(runOf(start));

      expect(next.match?.attempt).toEqual({
        id: 'e_202610261_1',
        at: NOW + 60_000,
      });
      expect(next.note).toEqual({ kind: 'endless', match: 2 });
      expect(next.run).toEqual({ runId: '202610261', next: 2 });
    });

    it('plays the rest of the run unranked when a match cannot be declared', async () => {
      const service = configure();
      const start = await service.startRun();
      ranked.offline = true;

      expect(await service.declareRunMatch(runOf(start))).toEqual({
        match: null,
        note: { kind: 'unranked', reason: 'run-dropped' },
        run: null,
      });
    });

    it('plays unranked once the five runs of the day are started', async () => {
      for (const r of [1, 2, 3, 4, 5]) {
        ranked.seed(`e_20261026${r}_0`);
      }

      expect(await configure().startRun()).toEqual({
        match: null,
        note: { kind: 'unranked', reason: 'runs-used' },
        run: null,
      });
    });
  });
});
