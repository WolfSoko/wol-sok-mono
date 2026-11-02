import { TestBed } from '@angular/core/testing';
import { MatchEngine } from '../state/match-engine';
import { MatchPlan, planMatch } from '../state/match-setup';
import { TICK_MS } from '../state/fixed-tick';
import { ArenaFrame, ArenaLayout, ArenaPainter } from './arena-painter';
import { arenaTheme } from './arena-theme';
import {
  ARENA_PAINTER_FACTORY,
  ArenaScene,
  ArenaViewComponent,
} from './arena-view.component';

const PLAN: MatchPlan = {
  levelId: 'petri-dish',
  mode: 'vs-computer',
  difficulty: 'normal',
  colors: ['orange', 'blue'],
  headStart: 0,
  width: 320,
  height: 140,
  seed: 1234,
};

const LAYOUT: ArenaLayout = {
  width: PLAN.width,
  height: PLAN.height,
  scale: 2,
  detail: 2,
  unit: 1,
  softwareWebGl: false,
};

/** A painter that keeps what it was asked to paint - jsdom draws nothing. */
class RecordingPainter implements ArenaPainter {
  public readonly kind = 'canvas';
  public readonly frames: ArenaFrame[] = [];
  public floors = 0;
  public shown = 0;
  public disposed = false;

  public setFloor(): void {
    this.floors++;
  }

  public paint(frame: ArenaFrame): void {
    this.frames.push(frame);
  }

  public showLastFrame(): void {
    this.shown++;
  }

  public dispose(): void {
    this.disposed = true;
  }
}

/** The animation frames, run one at a time by the spec. */
class AnimationFrames {
  private callbacks = new Map<number, FrameRequestCallback>();
  private next = 1;
  public now = 0;

  public install(): void {
    jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        const id = this.next++;
        this.callbacks.set(id, callback);
        return id;
      });
    jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((id) => this.callbacks.delete(id));
  }

  public get pending(): number {
    return this.callbacks.size;
  }

  /** Runs the frames requested so far, `ms` after the last ones. */
  public run(ms = TICK_MS): void {
    this.now += ms;
    const due = [...this.callbacks.values()];
    this.callbacks.clear();
    due.forEach((callback) => callback(this.now));
  }
}

/** A scene that shows an engine and plays it on, as a replay would. */
function engineScene(engine: MatchEngine): ArenaScene & { ticks: number } {
  const { width, height } = PLAN;
  const scene = {
    ticks: 0,
    content: (alpha: number) => ({
      walls: [],
      dynamicWalls: engine.simulation.getDynamicWalls(),
      colonies: engine.simulation
        .colonyLayers(new Map())
        .map((layer) => ({ ...layer, look: 'slime' as const })),
      reducedMotion: false,
      nutrients: engine.simulation.getNutrients(),
      balance: engine.balance,
      cursors: engine.players.map((player) => ({
        ...engine.crosshairAt(player, alpha, width, height),
        color: player.color,
        boostLeft: null,
      })),
    }),
    advance: (ticks: number) => {
      for (let tick = 0; tick < ticks; tick++) {
        engine.tick(width, height);
      }
      scene.ticks += ticks;
    },
  };
  return scene;
}

describe('ArenaViewComponent', () => {
  let frames: AnimationFrames;
  let painters: RecordingPainter[];
  let engine: MatchEngine;

  function create(scene: ArenaScene, autoplay = false) {
    TestBed.configureTestingModule({
      imports: [ArenaViewComponent],
      providers: [
        {
          provide: ARENA_PAINTER_FACTORY,
          useValue: () => {
            const painter = new RecordingPainter();
            painters.push(painter);
            return painter;
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ArenaViewComponent);
    fixture.componentRef.setInput('layout', LAYOUT);
    fixture.componentRef.setInput('scene', scene);
    fixture.componentRef.setInput('theme', arenaTheme(PLAN.levelId));
    fixture.componentRef.setInput('zones', []);
    fixture.componentRef.setInput('canvasId', 'arena');
    fixture.componentRef.setInput('autoplay', autoplay);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    frames = new AnimationFrames();
    frames.install();
    painters = [];
    const { spawns, options } = planMatch(PLAN);
    engine = new MatchEngine(spawns, options);
  });

  afterEach(() => {
    engine.dispose();
    jest.restoreAllMocks();
  });

  it('builds a painter for its canvas and lays the floor', () => {
    const fixture = create(engineScene(engine));

    const canvas = fixture.componentInstance.canvas();
    expect(canvas?.id).toBe('arena');
    expect(canvas?.dataset['renderer']).toBe('canvas');
    expect(painters).toHaveLength(1);
    expect(painters[0].floors).toBe(1);
  });

  it('renders the engine it is given, cleared, on the next frame', () => {
    const fixture = create(engineScene(engine));
    const painter = painters[0];

    frames.run();

    expect(painter.frames).toHaveLength(1);
    const [frame] = painter.frames;
    expect(frame.clear).toBe(true);
    expect(frame.view).toEqual({ x: 0, y: 0, width: 320, height: 140 });
    expect(frame.colonies.length).toBeGreaterThan(0);
    expect(frame.cursors).toHaveLength(engine.players.length);
    expect(fixture.componentInstance.shownView()).toEqual(frame.view);
  });

  it('paints the frames a match drives, fading into a trail', () => {
    const fixture = create(engineScene(engine));
    frames.run();
    const painter = painters[0];

    fixture.componentInstance.paintFrame(0.5, 0.25);
    fixture.componentInstance.paintFrame(0.5, 0.25);

    expect(painter.frames.map((frame) => frame.clear)).toEqual([
      true,
      false,
      false,
    ]);
    expect(painter.frames[2].timeSec).toBeCloseTo(1.001);
  });

  it('clears the frame after a fresh start', () => {
    const fixture = create(engineScene(engine));
    frames.run();

    fixture.componentInstance.clearNext();
    fixture.componentInstance.paintFrame(0.1, 0);

    expect(painters[0].frames[1].clear).toBe(true);
  });

  it('paints one still frame for any number of repaints', () => {
    const fixture = create(engineScene(engine));
    frames.run();

    fixture.componentInstance.repaint();
    fixture.componentInstance.repaint();
    frames.run();

    expect(painters[0].frames).toHaveLength(2);
  });

  it('shows what the scene points the camera at', () => {
    const view = { x: 10, y: 20, width: 160, height: 70 };
    const painted: ArenaFrame[] = [];
    create({
      ...engineScene(engine),
      view: () => view,
      painted: (frame) => painted.push(frame),
    });

    frames.run();

    expect(painters[0].frames[0].view).toEqual(view);
    expect(painted).toEqual(painters[0].frames);
  });

  it('puts the last frame back on the canvas for a snapshot', () => {
    const fixture = create(engineScene(engine));

    fixture.componentInstance.showLastFrame();

    expect(painters[0].shown).toBe(1);
  });

  describe('playing by itself', () => {
    it('advances the engine by the ticks of the frames and paints them', () => {
      const scene = engineScene(engine);
      create(scene, true);

      // The first frame paints the still frame and starts the clock.
      frames.run();
      for (let frame = 0; frame < 10; frame++) {
        frames.run();
      }

      expect(scene.ticks).toBe(10);
      expect(engine.tickCount).toBe(10);
      expect(painters[0].frames.length).toBeGreaterThan(10);
    });

    it('stops on pause and goes on where it stood on resume', () => {
      const scene = engineScene(engine);
      const fixture = create(scene, true);
      const view = fixture.componentInstance;
      frames.run();
      frames.run();
      frames.run();
      const before = scene.ticks;

      view.pause();
      fixture.detectChanges();
      frames.run();
      frames.run();

      expect(view.paused()).toBe(true);
      expect(scene.ticks).toBe(before);
      expect(frames.pending).toBe(0);

      view.resume();
      fixture.detectChanges();
      frames.run();
      frames.run();
      frames.run();

      expect(scene.ticks).toBe(before + 2);
    });

    it('runs the engine as many times as fast as the speed says', () => {
      const scene = engineScene(engine);
      const fixture = create(scene, true);
      frames.run();
      frames.run();

      fixture.componentInstance.speed.set(2);
      const before = scene.ticks;
      for (let frame = 0; frame < 10; frame++) {
        frames.run();
      }

      expect(scene.ticks - before).toBe(20);
    });

    it('waits for its frames while a match drives it', () => {
      const scene = engineScene(engine);
      create(scene);

      frames.run();
      frames.run();

      expect(scene.ticks).toBe(0);
      expect(frames.pending).toBe(0);
    });
  });

  it('builds a fresh painter for another layout and lets the old one go', () => {
    const fixture = create(engineScene(engine));
    const changes: (ArenaPainter | null)[] = [];
    fixture.componentInstance.painterChange.subscribe((painter) =>
      changes.push(painter)
    );

    fixture.componentRef.setInput('layout', { ...LAYOUT, scale: 4 });
    fixture.detectChanges();

    expect(painters).toHaveLength(2);
    expect(painters[0].disposed).toBe(true);
    expect(changes).toEqual([null, painters[1]]);
  });

  it('lets its painter go when it is destroyed, telling first', () => {
    const fixture = create(engineScene(engine));
    const changes: (ArenaPainter | null)[] = [];
    fixture.componentInstance.painterChange.subscribe((painter) =>
      changes.push(painter)
    );

    fixture.destroy();

    expect(changes).toEqual([null]);
    expect(painters[0].disposed).toBe(true);
  });
});
