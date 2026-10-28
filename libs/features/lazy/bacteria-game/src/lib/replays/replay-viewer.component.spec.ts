import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ArenaViewComponent } from '../arena/arena-view.component';
import { recordedReplay } from '../../testing/recorded-replay';
import {
  RecordingPainter,
  recordingPainters,
} from '../../testing/recording-painter';
import { I18nService } from '../i18n/i18n.service';
import { BALANCE_VERSION } from '../state/game-balance';
import { IntSimulation } from '../state/gpu-int/int-simulation';
import type { MatchEngine } from '../state/match-engine';
import { GPU_INT_REPLAY_VERSION, type Replay } from '../state/replay';
import { type GpuIntPainter, ReplayScene } from './replay-scene';
import {
  CHROME_HIDE_MS,
  ReplayViewerComponent,
} from './replay-viewer.component';

/** The colony sizes the scene's war got to. */
const sizes = (scene: ReplayScene) =>
  (scene as unknown as { engine: MatchEngine }).engine.players.map(
    (player) => player.bacteriaCount
  );

/** Plays the frames a seek takes, as the view would. */
function finishSeek(scene: ReplayScene): void {
  for (let frame = 0; scene.seeking && frame < 1000; frame++) {
    scene.advance(1);
  }
}

/** A replay as the integer passes recorded it. */
function gpuIntReplay(): Replay {
  const replay = recordedReplay('petri-dish', 30);
  return {
    ...replay,
    header: {
      ...replay.header,
      simulation: 'gpu-int',
      version: GPU_INT_REPLAY_VERSION,
    },
  };
}

/** A GL painter whose integer passes are stood in for by their CPU twin. */
function fakeGpu(
  made: (simulation: IntSimulation) => void = () => undefined
): GpuIntPainter & { createSimulation: jest.Mock } {
  return {
    createSimulation: jest.fn((balance, random, options) => {
      const simulation = new IntSimulation(balance, random, options.matchSeed);
      Object.defineProperty(simulation, 'kind', { value: 'gpu' });
      made(simulation);
      return simulation as never;
    }),
  };
}

describe('ReplayScene', () => {
  const look = { look: 'slime' as const, reducedMotion: false };

  it('plays a recorded match to its end, and from the start again', () => {
    const replay = recordedReplay('petri-dish', 60);
    const scene = ReplayScene.of(replay, look);

    scene?.advance(replay.header.ticks + 10);

    expect(scene?.over).toBe(true);
    expect(scene?.tick).toBe(replay.header.ticks);
    expect(scene?.content(0.5).colonies.length).toBeGreaterThan(0);
    scene?.restart();
    expect(scene?.over).toBe(false);
    expect(scene?.tick).toBe(0);
    scene?.dispose();
  });

  it('seeks on and back to the war it reaches when played straight', () => {
    const replay = recordedReplay('petri-dish', 90);
    const straight = ReplayScene.of(replay, look);
    const seeking = ReplayScene.of(replay, look);
    if (straight === null || seeking === null) {
      throw new Error('The replay did not play');
    }

    straight.advance(60);
    seeking.seek(60);
    expect(seeking.seeking).toBe(true);
    finishSeek(seeking);

    expect(seeking.tick).toBe(60);
    expect(sizes(seeking)).toEqual(sizes(straight));

    // Back plays from the start again, to the same war.
    seeking.seek(20);
    finishSeek(seeking);
    const again = ReplayScene.of(replay, look);
    again?.advance(20);

    expect(seeking.tick).toBe(20);
    expect(again && sizes(again)).toEqual(sizes(seeking));
    [straight, seeking, again].forEach((scene) => scene?.dispose());
  });

  it('seeks no further than the replay goes', () => {
    const replay = recordedReplay('petri-dish', 30);
    const scene = ReplayScene.of(replay, look);

    scene?.seek(10_000);
    if (scene !== null) {
      finishSeek(scene);
    }

    expect(scene?.tick).toBe(replay.header.ticks);
    expect(scene?.over).toBe(true);
    scene?.dispose();
  });

  it('plays a gpu-int replay on the GPU handed in, from the start again too', () => {
    const gpu = fakeGpu();
    const scene = ReplayScene.of(gpuIntReplay(), look, gpu);

    expect(scene?.onGpu).toBe(true);
    scene?.advance(5);
    scene?.restart();

    expect(gpu.createSimulation).toHaveBeenCalledTimes(2);
    expect(scene?.onGpu).toBe(true);
    scene?.dispose();
    scene?.dispose();
  });

  it('plays a gpu-int replay on the CPU without a GPU, and a cpu one on a GPU', () => {
    const gpu = fakeGpu();
    const scenes = [
      ReplayScene.of(gpuIntReplay(), look),
      ReplayScene.of(recordedReplay('petri-dish', 30), look, gpu),
    ];

    expect(scenes.map((scene) => scene?.onGpu)).toEqual([false, false]);
    expect(gpu.createSimulation).not.toHaveBeenCalled();
    scenes.forEach((scene) => scene?.dispose());
  });

  it('moves between the GPU and the CPU where it was', () => {
    const replay = gpuIntReplay();
    const gpu = fakeGpu();
    const scene = ReplayScene.of(replay, look);
    const straight = ReplayScene.of(replay, look);
    if (scene === null || straight === null) {
      throw new Error('The replay did not play');
    }
    scene.advance(12);

    scene.useGpu(gpu);
    expect(scene.onGpu).toBe(true);
    expect(scene.shownTick).toBe(12);
    finishSeek(scene);
    scene.useGpu(gpu);
    scene.useGpu(null);
    finishSeek(scene);
    straight.advance(12);

    expect(gpu.createSimulation).toHaveBeenCalledTimes(1);
    expect(scene.onGpu).toBe(false);
    expect(scene.tick).toBe(12);
    expect(sizes(scene)).toEqual(sizes(straight));
    [scene, straight].forEach((each) => each.dispose());
  });

  it('falls back to the CPU when the GPU does not set up, and asks it no more', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = new IntSimulation({} as never, () => 0.5, 1);
    const dispose = jest.spyOn(broken, 'dispose');
    jest.spyOn(broken, 'resize').mockImplementation(() => {
      throw new Error('Incomplete render target');
    });
    const createSimulation = jest.fn(() => broken as never);
    const gpu = { createSimulation };

    const scene = ReplayScene.of(gpuIntReplay(), look, gpu);

    expect(dispose).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(scene?.onGpu).toBe(false);
    scene?.advance(5);
    expect(scene?.tick).toBe(5);
    scene?.restart();
    scene?.useGpu(gpu);
    expect(createSimulation).toHaveBeenCalledTimes(1);
    scene?.dispose();
    warn.mockRestore();
  });

  it('falls back when the engine fails to set the GPU up, letting go of it', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const made: IntSimulation[] = [];
    const failing = fakeGpu((simulation) => {
      jest.spyOn(simulation, 'init').mockImplementation(() => {
        throw new Error('Texture upload refused');
      });
      jest.spyOn(simulation, 'dispose');
      made.push(simulation);
    });

    const scene = ReplayScene.of(gpuIntReplay(), look, failing);

    expect(scene?.onGpu).toBe(false);
    expect(made).toHaveLength(1);
    expect(made[0].dispose).toHaveBeenCalled();
    scene?.advance(3);
    expect(scene?.tick).toBe(3);
    scene?.dispose();
    warn.mockRestore();
  });

  it('does nothing more once disposed', () => {
    const gpu = fakeGpu();
    const scene = ReplayScene.of(gpuIntReplay(), look, gpu);

    scene?.dispose();
    scene?.restart();
    scene?.useGpu(null);
    scene?.seek(0);
    scene?.advance(5);

    expect(gpu.createSimulation).toHaveBeenCalledTimes(1);
    expect(scene?.tick).toBe(0);
  });

  it('plays no replay of another balance', () => {
    const replay = recordedReplay();
    const older = {
      ...replay,
      header: { ...replay.header, balanceVersion: BALANCE_VERSION - 1 },
    };

    expect(ReplayScene.of(older, look)).toBeNull();
  });
});

describe('ReplayViewerComponent', () => {
  let painters: RecordingPainter[];

  beforeEach(() => {
    painters = [];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [recordingPainters(painters)],
    });
    TestBed.inject(I18nService).setLanguage('en');
  });

  function view(
    replay = recordedReplay(),
    inputs: Record<string, unknown> = {},
    beforeRender: (host: HTMLElement) => void = () => undefined
  ) {
    const fixture = TestBed.createComponent(ReplayViewerComponent);
    fixture.componentRef.setInput('replay', replay);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    const page = fixture.nativeElement as HTMLElement;
    beforeRender(page);
    fixture.detectChanges();
    return { fixture, page };
  }

  const playPause = (page: HTMLElement) =>
    page.querySelector('[data-testid="play-pause"]') as HTMLButtonElement;
  const time = (page: HTMLElement) =>
    page.querySelector('.time')?.textContent?.replace(/\s+/g, ' ').trim();
  const chromeHidden = (page: HTMLElement) =>
    page.classList.contains('chrome-hidden');
  const key = (page: HTMLElement, key: string) => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    });
    page.dispatchEvent(event);
    return event;
  };

  it('plays the replay on an arena view, with pause and speeds', () => {
    const { fixture, page } = view();

    expect(page.querySelector('feat-lazy-bac-game-arena-view')).not.toBeNull();
    expect(painters).toHaveLength(1);
    expect(page.getAttribute('tabindex')).toBe('0');
    const button = playPause(page);
    expect(button.getAttribute('aria-label')).toBe('Pause');
    expect(button.textContent).toContain('pause');

    button.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-label')).toBe('Play');
    expect(button.textContent).toContain('play_arrow');
    expect(page.textContent).toContain('4×');
    expect(
      page.querySelector('[role="group"]')?.getAttribute('aria-label')
    ).toBe('Playback controls');
  });

  it('shows the time and seeks with the skip buttons, playing on to it while paused', () => {
    const { fixture, page } = view(recordedReplay('petri-dish', 90));
    const arena = fixture.debugElement.query(By.directive(ArenaViewComponent))
      .componentInstance as ArenaViewComponent;

    expect(time(page)).toBe('0:00 / 0:01');
    playPause(page).click();
    fixture.detectChanges();
    expect(arena.paused()).toBe(true);

    (page.querySelector('[data-testid="forward"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(page.textContent).toContain('Winding to that time…');
    expect(time(page)).toBe('0:01 / 0:01');
    // Paused, the view still runs the frames the seek plays in.
    expect(arena.paused()).toBe(false);
  });

  it('fits the arena into the box it has, at its aspect, as large as it lets it', () => {
    const { fixture } = view(recordedReplay('petri-dish', 60, 7, 'high'));
    const arena = fixture.debugElement.query(By.directive(ArenaViewComponent))
      .componentInstance as ArenaViewComponent;
    // Unmeasured, the canvas keeps its own size.
    expect(arena.size()).toEqual({ width: 960, height: 540 });

    (
      fixture.componentInstance as unknown as {
        boxSize: { set(size: { width: number; height: number }): void };
      }
    ).boxSize.set({ width: 1920, height: 600 });
    fixture.detectChanges();

    // The height binds: 600 tall, 16:9 wide.
    expect(arena.size()).toEqual({ width: 1066, height: 600 });
  });

  describe('the controls', () => {
    beforeEach(() => {
      jest.useFakeTimers({
        doNotFake: [
          'queueMicrotask',
          'nextTick',
          'requestAnimationFrame',
          'cancelAnimationFrame',
        ],
      });
    });
    afterEach(() => jest.useRealTimers());

    it('go after a while as the replay plays, and come back on a move', () => {
      const { fixture, page } = view();
      expect(chromeHidden(page)).toBe(false);

      jest.advanceTimersByTime(CHROME_HIDE_MS);
      fixture.detectChanges();
      expect(chromeHidden(page)).toBe(true);
      expect(page.classList.contains('cursor-hidden')).toBe(true);

      page.dispatchEvent(new Event('pointermove', { bubbles: true }));
      fixture.detectChanges();
      expect(chromeHidden(page)).toBe(false);
      expect(page.classList.contains('cursor-hidden')).toBe(false);
    });

    it('stay while the replay is paused, and while the pointer is on them', () => {
      const { fixture, page } = view();
      playPause(page).click();
      fixture.detectChanges();

      jest.advanceTimersByTime(CHROME_HIDE_MS * 2);
      fixture.detectChanges();
      expect(chromeHidden(page)).toBe(false);

      // Playing again, but hovered.
      const chrome = page.querySelector('.chrome.bottom') as HTMLElement;
      chrome.dispatchEvent(new Event('pointerenter'));
      playPause(page).click();
      jest.advanceTimersByTime(CHROME_HIDE_MS * 2);
      fixture.detectChanges();
      expect(chromeHidden(page)).toBe(false);

      chrome.dispatchEvent(new Event('pointerleave'));
      fixture.detectChanges();
      expect(chromeHidden(page)).toBe(true);
    });

    it('clear their timer when the viewer goes', () => {
      const { fixture } = view();
      const cleared = jest.spyOn(globalThis, 'clearTimeout');

      fixture.destroy();

      expect(cleared).toHaveBeenCalled();
      cleared.mockRestore();
    });
  });

  it('pauses and plays on a click on the arena, like a video', () => {
    const { fixture, page } = view();
    const arena = page.querySelector('.arena') as HTMLElement;

    arena.click();
    fixture.detectChanges();
    expect(playPause(page).getAttribute('aria-label')).toBe('Play');

    arena.click();
    fixture.detectChanges();
    expect(playPause(page).getAttribute('aria-label')).toBe('Pause');
  });

  it('takes the keys of a video player on the host, and goes no further with them', () => {
    const { fixture, page } = view(recordedReplay('petri-dish', 90));
    const reached = jest.fn();
    document.addEventListener('keydown', reached);

    const space = key(page, ' ');
    fixture.detectChanges();
    expect(playPause(page).getAttribute('aria-label')).toBe('Play');
    expect(space.defaultPrevented).toBe(true);

    key(page, 'ArrowRight');
    fixture.detectChanges();
    expect(page.textContent).toContain('Winding to that time…');

    // A key it has no use for goes on to the stage.
    const other = key(page, 'x');
    expect(other.defaultPrevented).toBe(false);
    expect(reached).toHaveBeenCalledTimes(1);
    expect(reached).toHaveBeenCalledWith(other);
    document.removeEventListener('keydown', reached);
  });

  it('leaves the keys on the controls to them', () => {
    const { fixture, page } = view();

    const seek = page.querySelector('[data-testid="seek"]') as HTMLElement;
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    });
    seek.dispatchEvent(event);
    fixture.detectChanges();

    expect(event.defaultPrevented).toBe(false);
    expect(playPause(page).getAttribute('aria-label')).toBe('Pause');
  });

  it('shows a way out and a title over the arena where the host gives them', () => {
    const { fixture, page } = view(recordedReplay(), {
      title: 'Petri dish',
      closeLabel: 'Back to the list',
    });
    const closed = jest.fn();
    fixture.componentInstance.close.subscribe(closed);

    expect(page.querySelector('.chrome.top')?.textContent).toContain(
      'Petri dish'
    );
    (
      page.querySelector('button[aria-label="Back to the list"]') as HTMLElement
    ).click();

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('renders no top chrome without a title or a way out', () => {
    const { page } = view();

    expect(page.querySelector('.chrome.top')).toBeNull();
    expect(page.querySelector('[data-testid="close"]')).toBeNull();
    expect(page.querySelector('.chrome.bottom')).not.toBeNull();
  });

  describe('the fullscreen', () => {
    afterEach(() => {
      delete (document as { fullscreenEnabled?: boolean }).fullscreenEnabled;
    });

    it('is not offered where the browser has none', () => {
      const { page } = view();

      expect(page.querySelector('[data-testid="fullscreen"]')).toBeNull();
      // F does nothing, and goes on to the stage.
      expect(key(page, 'f').defaultPrevented).toBe(false);
    });

    it('is asked of the browser for the viewer itself where it has one', () => {
      Object.defineProperty(document, 'fullscreenEnabled', {
        value: true,
        configurable: true,
      });
      const requested = jest.fn(async () => undefined);
      const { fixture, page } = view(recordedReplay(), {}, (host) => {
        Object.defineProperty(host, 'requestFullscreen', {
          value: requested,
          configurable: true,
        });
      });

      const button = page.querySelector(
        '[data-testid="fullscreen"]'
      ) as HTMLButtonElement;
      expect(button.getAttribute('aria-label')).toBe('Fullscreen');
      button.click();
      expect(requested).toHaveBeenCalledTimes(1);

      // F asks too, and stays with the viewer.
      expect(key(page, 'f').defaultPrevented).toBe(true);
      expect(requested).toHaveBeenCalledTimes(2);

      // The browser put it on the screen: the button offers the way out.
      Object.defineProperty(document, 'fullscreenElement', {
        value: page,
        configurable: true,
      });
      document.dispatchEvent(new Event('fullscreenchange'));
      fixture.detectChanges();
      expect(button.getAttribute('aria-label')).toBe('Exit fullscreen');
      expect(button.textContent).toContain('fullscreen_exit');
      delete (document as { fullscreenElement?: Element }).fullscreenElement;
    });
  });

  it('lays out a replay on its own grid, not the online one', () => {
    const { fixture } = view(recordedReplay('petri-dish', 60, 7, 'high'));

    const arena = fixture.debugElement.query(By.directive(ArenaViewComponent))
      .componentInstance as ArenaViewComponent;
    // "High": 1.5 cells per base cell, on the canvas of the online grid.
    expect(arena.layout()).toEqual(
      expect.objectContaining({ width: 480, height: 270, unit: 1.5, scale: 2 })
    );
  });

  it('says so for a replay it cannot play', () => {
    const replay = recordedReplay();
    const { page } = view({
      ...replay,
      header: { ...replay.header, balanceVersion: BALANCE_VERSION - 1 },
    });

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'older version'
    );
    expect(page.querySelector('feat-lazy-bac-game-arena-view')).toBeNull();
  });

  it('lets go of the painter and the engine when it goes', () => {
    const { fixture } = view();

    fixture.destroy();

    expect(painters[0].disposed).toBe(true);
  });
});
