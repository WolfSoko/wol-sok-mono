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
import type { SimulationFactory } from '../state/simulation';
import { gpuIntReplaySimulation, ReplayScene } from './replay-scene';
import { matchTime, ReplayViewerComponent } from './replay-viewer.component';

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

/** The GPU's integer passes, stood in for by their CPU twin. */
const fakeGpuInt: SimulationFactory = (balance, random, seed) => {
  const simulation = new IntSimulation(balance, random, seed);
  Object.defineProperty(simulation, 'kind', { value: 'gpu' });
  return simulation;
};

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
    const gpu = jest.fn(fakeGpuInt);
    const scene = ReplayScene.of(gpuIntReplay(), look, gpu);

    expect(scene?.onGpu).toBe(true);
    scene?.advance(5);
    scene?.restart();

    expect(gpu).toHaveBeenCalledTimes(2);
    expect(scene?.onGpu).toBe(true);
    scene?.dispose();
    scene?.dispose();
  });

  it('plays a gpu-int replay on the CPU without a GPU', () => {
    const scene = ReplayScene.of(gpuIntReplay(), look);

    expect(scene?.onGpu).toBe(false);
    scene?.dispose();
  });

  it('falls back to the CPU when the GPU does not set up', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = new IntSimulation({} as never, () => 0.5, 1);
    const dispose = jest.spyOn(broken, 'dispose');
    jest.spyOn(broken, 'resize').mockImplementation(() => {
      throw new Error('Incomplete render target');
    });
    const factory = gpuIntReplaySimulation(
      { createSimulation: () => broken as never },
      320,
      180
    );

    const scene = ReplayScene.of(gpuIntReplay(), look, factory);

    expect(dispose).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(scene?.onGpu).toBe(false);
    scene?.advance(5);
    expect(scene?.tick).toBe(5);
    scene?.dispose();
    warn.mockRestore();
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

  function view(replay = recordedReplay()) {
    const fixture = TestBed.createComponent(ReplayViewerComponent);
    fixture.componentRef.setInput('replay', replay);
    fixture.detectChanges();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  it('plays the replay on an arena view, with pause and speeds', () => {
    const { fixture, page } = view();

    expect(page.querySelector('feat-lazy-bac-game-arena-view')).not.toBeNull();
    expect(painters).toHaveLength(1);
    const button = page.querySelector(
      '[data-testid="play-pause"]'
    ) as HTMLButtonElement;
    expect(button.textContent).toContain('Pause');

    button.click();
    fixture.detectChanges();

    expect(button.textContent).toContain('Play');
    expect(page.textContent).toContain('4×');
  });

  it('shows the time and seeks with the skip buttons, playing on to it while paused', () => {
    const { fixture, page } = view(recordedReplay('petri-dish', 90));
    const arena = fixture.debugElement.query(By.directive(ArenaViewComponent))
      .componentInstance as ArenaViewComponent;
    const times = () =>
      Array.from(page.querySelectorAll('.time')).map((time) =>
        time.textContent?.trim()
      );

    expect(times()).toEqual(['0:00', '0:02']);
    (page.querySelector('[data-testid="play-pause"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(arena.paused()).toBe(true);

    (page.querySelector('[data-testid="forward"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(page.textContent).toContain('Winding to that time…');
    expect(times()[0]).toBe('0:02');
    // Paused, the view still runs the frames the seek plays in.
    expect(arena.paused()).toBe(false);
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

describe('matchTime', () => {
  it('reads minutes and seconds', () => {
    expect(matchTime(0)).toBe('0:00');
    expect(matchTime(65.9)).toBe('1:05');
    expect(matchTime(600)).toBe('10:00');
  });
});
