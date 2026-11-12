import { DOCUMENT } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { recordedReplay } from '@wolsok/feat-shared-bacteria-engine/testing';
import { recordingPainters } from '../../testing/recording-painter';
import { I18nService } from '../i18n/i18n.service';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import {
  BALANCE_VERSION,
  GPU_INT_REPLAY_VERSION,
  type Replay,
  replayToBytes,
} from '@wolsok/feat-shared-bacteria-engine';
import { ReplayViewerComponent } from './replay-viewer.component';
import { WatchGpu } from './watch-gpu';
import { PublicReplayResult, PublicReplays } from './public-replays';
import { WatchPageComponent } from './watch-page.component';

const ID = 'AbCdEfGhIjKlMnOpQrSt';

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }
}

/** A stand-in for the page's GPU source, telling how often it started. */
function fakeWatchGpu(renderer: string | null = null) {
  const trusted = signal(renderer);
  return {
    starts: 0,
    trusted,
    trustedRenderer: () => trusted(),
    start() {
      this.starts++;
    },
  };
}

describe('WatchPageComponent', () => {
  let watchGpu: ReturnType<typeof fakeWatchGpu>;

  beforeEach(() => {
    watchGpu = fakeWatchGpu();
  });

  async function open(result: PublicReplayResult) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        recordingPainters(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ publicId: ID })) },
        },
        { provide: PublicReplays, useValue: { load: async () => result } },
        { provide: WatchGpu, useValue: watchGpu },
      ],
    });
    TestBed.inject(I18nService).setLanguage('en');
    const fixture = TestBed.createComponent(WatchPageComponent);
    await settle(fixture);
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  it('plays a public replay, noindex, with its canonical on its page', async () => {
    const { fixture, page } = await open({ replay: recordedReplay() });

    expect(page.querySelector('h1')?.textContent).toContain('Featured match:');
    expect(
      page.querySelector('feat-lazy-bac-game-replay-viewer')
    ).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).toContain('- Bacteria Wars');
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe(
      'noindex'
    );
    const document = TestBed.inject(DOCUMENT);
    expect(
      document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')
    ).toBe(`https://bacteria-wars.wolsok.de/replays/${ID}`);

    fixture.destroy();

    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(TestBed.inject(Meta).getTag('name="robots"')).toBeNull();
  });

  it('finds a trusted GPU for a gpu-int replay and hands it to the viewer', async () => {
    const replay = recordedReplay('petri-dish', 30);
    const { fixture } = await open({
      replay: {
        ...replay,
        header: {
          ...replay.header,
          simulation: 'gpu-int',
          version: GPU_INT_REPLAY_VERSION,
        },
      },
    });
    const viewer = () =>
      fixture.debugElement.query(By.directive(ReplayViewerComponent))
        .componentInstance as ReplayViewerComponent;

    expect(watchGpu.starts).toBe(1);
    expect(viewer().gpu()).toBeNull();

    watchGpu.trusted.set('Adreno 650');
    await settle(fixture);

    expect(viewer().gpu()).toBe('Adreno 650');
  });

  it('asks for no GPU for a cpu replay', async () => {
    await open({ replay: recordedReplay() });

    expect(watchGpu.starts).toBe(0);
  });

  it('says why a replay does not play', async () => {
    const { page } = await open({ error: 'not-found' });

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'There is no public match at this address.'
    );
    expect(page.querySelector('feat-lazy-bac-game-replay-viewer')).toBeNull();
  });

  it('says so for a replay that was taken down', async () => {
    const { page } = await open({ error: 'removed' });

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'This match has been taken down.'
    );
  });
});

describe('PublicReplays', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function answer(status: number, body: unknown = null): string[] {
    const asked: string[] = [];
    globalThis.fetch = (async (url: string) => {
      asked.push(url);
      return {
        status,
        ok: status >= 200 && status < 300,
        json: async () => body,
      };
    }) as unknown as typeof fetch;
    return asked;
  }

  const load = (id = ID) => TestBed.inject(PublicReplays).load(id);

  /** As `publicSite` answers: the packed bytes, base64. */
  async function served(replay: Replay): Promise<{ bytes: string }> {
    const bytes = await replayToBytes(replay, { forPublic: true });
    return { bytes: Buffer.from(bytes).toString('base64') };
  }

  it('loads a public replay from publicSite', async () => {
    const replay = recordedReplay();
    const asked = answer(200, await served(replay));

    const result = await load();

    expect(asked).toEqual([`/replays/${ID}/replay.json`]);
    expect('replay' in result && result.replay.header.seed).toBe(
      replay.header.seed
    );
  });

  it('tells a missing, a removed, a broken and an older replay apart', async () => {
    answer(404);
    expect(await load()).toEqual({ error: 'not-found' });
    answer(410);
    expect(await load()).toEqual({ error: 'removed' });
    answer(200, { bytes: 'bm90IGEgcmVwbGF5' });
    expect(await load()).toEqual({ error: 'unreadable' });
    answer(503);
    expect(await load()).toEqual({ error: 'offline' });
    const replay = recordedReplay();
    answer(
      200,
      await served({
        ...replay,
        header: { ...replay.header, balanceVersion: BALANCE_VERSION - 1 },
      })
    );
    expect(await load()).toEqual({ error: 'older' });
  });

  it('never asks for an id that is not a public one', async () => {
    const asked = answer(200);

    expect(await load('../admin')).toEqual({ error: 'not-found' });
    expect(asked).toEqual([]);
  });
});
