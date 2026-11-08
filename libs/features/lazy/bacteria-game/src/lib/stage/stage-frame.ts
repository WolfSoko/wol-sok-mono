import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdaptiveQuality } from '../arena/adaptive-quality';
import { DishAmbience } from '../arena/ambience';
import { arenaContent, SeatColors } from '../arena/arena-content';
import type { ArenaPainter } from '../arena/arena-painter';
import type { ArenaContent, ArenaScene } from '../arena/arena-view.component';
import { Camera, CameraShake } from '../arena/camera';
import { FramePerf } from '../arena/frame-perf';
import { MinimapPainter } from '../arena/minimap';
import { EvolutionService } from '../evolution.service';
import type { GpuTimer } from '../gl/gpu-timer';
import { GameHapticsService } from '../haptics.service';
import { HudPerf, simulationLabel } from '../hud-perf';
import { GameSettingsService } from '../settings.service';
import { GameSoundService } from '../sound/game-sound.service';
import {
  computerLook,
  DynamicWall,
  GameFrame,
  Point,
  Rect,
  runsOnGpu,
  seatLooks,
  type WeaponFire,
} from '@wolsok/feat-shared-bacteria-engine';
import { GameStateService } from '../state/game-state.service';
import { GameStateStore } from '../state/game.states';
import { PlayerService } from '../state/player.service';
import { PlayerStore } from '../state/player.store';
import { ArenaStage } from './arena-stage';

/** How often the minimap takes in where the colonies are. */
const MINIMAP_UPDATE_MS = 100;

/**
 * What the stage paints, frame by frame: the war advanced by the game loop,
 * the camera over a big map and its shake, the ambience over the arena,
 * the minimap, and the sharpness and timings of the frames. Provided by the
 * stage component, beside the {@link ArenaStage} it paints.
 */
@Injectable()
export class StageFrame {
  private readonly stage = inject(ArenaStage);
  private readonly store = inject(GameStateStore);
  private readonly gameStateService = inject(GameStateService);
  private readonly playerService = inject(PlayerService);
  private readonly playerStore = inject(PlayerStore);
  private readonly settings = inject(GameSettingsService);
  /** Reads the frame rate switch - made once, as the frames read it each. */
  private readonly showsFps = () => this.settings.value('showFps');
  private readonly sound = inject(GameSoundService);
  private readonly haptics = inject(GameHapticsService);
  /** The skin the player's colony wears: the look picked, once owned. */
  private readonly skin = inject(EvolutionService).worn;
  /** The look the computer wears on the level - see `seatLooks`. */
  private readonly computerLook = computed(() =>
    computerLook(this.store.level().id)
  );

  /** The bubbles and the mist in the dish, over the arena - null without a painter. */
  private ambience: DishAmbience | null = null;
  /** The view the ambience was last drawn still for - nothing to redraw while it holds. */
  private stillAmbience: Rect | null = null;
  /** The camera over a map bigger than the base arena, null on any other. */
  private camera: Camera | null = null;
  /** When the camera last moved on, null before it ever did. */
  private cameraMovedAt: number | null = null;
  /** The shake of the view as a weapon goes off - on every map. */
  private readonly shake = new CameraShake();
  /** Each seat's colony colour - built anew only when a match's colours do. */
  private readonly seatColors = new SeatColors();
  /** The weapons fired since the frame before, for the next frame's content. */
  private pendingFires: readonly WeaponFire[] = [];
  /** Where the camera stands without the shake - what the minimap frames. */
  private lastCamera: Rect | null = null;
  /** The whole map in a corner, while the camera shows part of it. */
  private minimap: MinimapPainter | null = null;
  /** When the minimap last took in where the colonies are. */
  private minimapUpdatedAt = Number.NEGATIVE_INFINITY;
  /** Where the frames spend their time, while the HUD shows it. */
  private readonly framePerf = new FramePerf();
  /** How many of the canvas's pixels the frames of a match are built with. */
  private readonly quality = new AdaptiveQuality();
  /** Where the last match on each arena size left it - for the next one. */
  private readonly qualityByArena = new Map<string, number>();
  /** True while a match on, with the setting, adapts the sharpness. */
  private readonly adapts = computed(
    () => this.stage.running() && this.settings.value('adaptiveQuality')
  );
  /**
   * The breakdown of a frame beside the frame rate - null while the
   * settings hide the frame rate, or before a window of frames is over.
   */
  public readonly hudPerf = signal<HudPerf | null>(null);

  /** What the arena view paints: the match as it stands. */
  public readonly scene: ArenaScene = {
    content: (alpha) => this.content(alpha),
    view: () => this.shakenView(),
    painted: (frame) => {
      this.stage.arenaPaintedAfterReset();
      this.paintAmbience(frame.view, frame.deltaTimeSec);
      this.paintMinimap(this.lastCamera ?? frame.view, frame.dynamicWalls);
    },
  };

  public constructor() {
    // Repaint as soon as another level puts different walls into the arena, or
    // the colonies change colour or look, so the start screen always shows
    // the map and the colonies the next match is fought with. A clear frame
    // also wipes the glow from the trail once the player asks for less
    // motion, even while the game is paused. The arena view lays another
    // level's floor itself.
    effect(() => {
      this.ambience?.setTheme(this.stage.theme());
      this.stage.walls();
      this.store.colors();
      this.skin();
      this.settings.value('ambience');
      this.stage.reducedMotion();
      this.stage.draw();
    });

    // The minimap is drawn afresh for another map, and goes with the match.
    effect(() => {
      const canvas = this.stage.minimapCanvas()?.nativeElement;
      const cx = canvas?.getContext('2d');
      const { width, height } = this.stage.arena();
      const theme = this.stage.theme();
      const walls = this.stage.walls();
      untracked(() => {
        this.minimap =
          cx == null ? null : new MinimapPainter(cx, width, height);
        this.minimap?.setMap(theme, walls);
        this.minimapUpdatedAt = Number.NEGATIVE_INFINITY;
        this.stage.draw();
      });
    });

    // A pause or the end of a match stops the match's frames: one more
    // frame lets the camera ease on by itself from there.
    effect(() => {
      if (!this.stage.running() || this.stage.paused()) {
        untracked(() => this.stage.draw());
      }
    });
    // The breakdown of a frame starts over with each match, and whenever
    // the frame rate is shown again - no frames of before in its average.
    effect(() => {
      this.settings.value('showFps');
      this.stage.running();
      untracked(() => {
        this.framePerf.reset();
        this.hudPerf.set(null);
      });
    });
    // A match starts at the sharpness the last one on its arena ended with;
    // between matches, and with the setting off, every pixel is painted.
    effect(() => {
      const adapts = this.adapts();
      untracked(() => {
        const { width, height } = this.stage.arena();
        const remembered = this.qualityByArena.get(arenaKey(width, height));
        this.quality.start(adapts ? (remembered ?? 1) : 1);
        this.stage.currentPainter()?.setRenderScale?.(this.quality.scale);
      });
    });

    this.gameStateService.frames$
      .pipe(takeUntilDestroyed())
      .subscribe((frame) => this.runFrame(frame));
  }

  /**
   * Takes the painter the arena view built for a fresh canvas, at the
   * resolutions it was rendered for - null right before it lets go of the
   * one before - with a camera and an ambience for its arena.
   */
  public onPainterChange(painter: ArenaPainter | null): void {
    const built = this.stage.takePainter(painter);
    painter?.setRenderScale?.(this.quality.scale);
    if (!built) {
      return;
    }
    const { width, height } = this.stage.arena();
    const mapSize = this.stage.mapSize();
    this.camera = mapSize > 1 ? new Camera(width, height, mapSize) : null;
    this.ambience = new DishAmbience(width, height);
    this.ambience.setTheme(this.stage.theme());
    this.stage.chooseSimulationFor(painter);
    this.stage.draw();
  }

  /** Readies the stage for a fresh match: no frame of before, no shake. */
  public newMatch(): void {
    this.stage.arenaView()?.clearNext();
    this.camera?.reset();
    this.cameraMovedAt = null;
    this.shake.reset();
  }

  /**
   * True while the camera may zoom: over a big map, in a match it follows
   * the one human through - with two, it shows the whole map.
   */
  public zooms(): boolean {
    return this.camera != null && this.cameraTarget() != null;
  }

  /** Zooms the camera by the factor, in or out. */
  public zoomBy(factor: number): void {
    if (factor === 1) {
      return;
    }
    this.camera?.zoomBy(factor);
    if (!this.matchPaints()) {
      this.stage.draw();
    }
  }

  /**
   * Advances the war by the frame's ticks and paints it - called by the game
   * loop, inside the animation frame, so what is painted is shown on that
   * frame.
   */
  private runFrame(frame: GameFrame): void {
    const painter = this.stage.currentPainter();
    if (painter == null) {
      return;
    }
    const { width, height } = this.stage.arena();
    // Timed only while the HUD shows the frame rate.
    const perf = untracked(this.showsFps) ? this.framePerf : null;
    const timer = perf === null ? null : (painter.gpuTimer?.() ?? null);
    // The ticks' GPU time where the war runs on the GPU.
    const simulation = this.playerService.getSimulation();
    const simTimer =
      timer !== null && runsOnGpu(simulation.variant) ? timer : null;
    const adapting = painter.setRenderScale != null && untracked(this.adapts);
    // The main thread's time is taken where the HUD or the sharpness asks.
    const timed = perf !== null || adapting;
    const start = timed ? performance.now() : 0;
    simTimer?.begin('sim');
    this.gameStateService.advance(width, height, frame.ticks);
    simTimer?.end();
    const ticked = timed ? performance.now() : 0;
    const events = this.playerService.getFrameEvents();
    this.sound.frame(events);
    this.haptics.frame(events);
    this.shake.fire(events.weapons, this.stage.reducedMotion());
    // The shake goes with the match's frames: a pause holds the view still.
    this.shake.advance(frame.elapsedSec);
    this.pendingFires = events.weapons;
    const painting = perf === null ? 0 : performance.now();
    timer?.begin('draw');
    this.stage.arenaView()?.paintFrame(frame.elapsedSec, frame.alpha);
    timer?.end();
    const end = timed ? performance.now() : 0;
    // A simulation's wait for the GPU is the GPU's time, not the main
    // thread's own.
    const gpuWait = simulation.takeGpuWaitMs?.() ?? 0;
    if (adapting) {
      // The sharpness goes by how long the main thread was busy with this
      // frame's ticks and painting.
      const scale = this.quality.frame(end, end - start - gpuWait);
      if (scale !== null) {
        this.qualityByArena.set(arenaKey(width, height), scale);
        painter.setRenderScale?.(scale);
      }
    }
    if (perf !== null) {
      this.notePerf(perf, timer, frame.ticks, start, ticked, painting, end);
    }
  }

  /** Takes a frame's timings, and shows the averages once a window is over. */
  private notePerf(
    perf: FramePerf,
    timer: GpuTimer | null,
    ticks: number,
    start: number,
    ticked: number,
    painting: number,
    end: number
  ): void {
    timer?.poll((slot, ms) => perf.recordGpu(slot, ms));
    const report = perf.record(end, ticked - start, end - painting, ticks);
    if (report === null) {
      return;
    }
    const simulation = this.playerService.getSimulation();
    const { width, height } = this.stage.arena();
    this.hudPerf.set({
      ...report,
      simulation: simulationLabel(simulation.variant),
      cells: arenaKey(width, height),
      // The Canvas 2D painter paints every pixel, whatever the scale says.
      // A share of the pixels: the scale goes for the width and the height.
      pixels:
        this.stage.currentPainter()?.setRenderScale == null
          ? 1
          : this.quality.scale ** 2,
    });
  }

  /**
   * Draws the bubbles and the mist over the arena, on the canvas laid over
   * it, at the arena canvas's own pixels. Still for a player who asked for
   * less motion, and while the match does not paint: then only the dish's
   * depth is drawn, and only once per view and canvas size.
   */
  private paintAmbience(view: Rect, deltaTimeSec: number): void {
    const ambience = this.ambience;
    if (ambience == null || !this.settings.value('ambience')) {
      return;
    }
    const reducedMotion = this.stage.reducedMotion();
    const moving = !reducedMotion && this.matchPaints();
    if (untracked(this.stage.painterAmbience)) {
      // The painter draws it with the arena: here it only moves on.
      if (moving) {
        ambience.advance(deltaTimeSec);
      }
      return;
    }
    const canvas = this.stage.ambienceCanvas()?.nativeElement;
    const arena = this.stage.arenaView()?.canvas();
    if (canvas == null || arena == null) {
      return;
    }
    const { width, height } = arena;
    const resized = canvas.width !== width || canvas.height !== height;
    if (resized) {
      canvas.width = width;
      canvas.height = height;
    }
    const still = this.stillAmbience;
    if (
      !moving &&
      !resized &&
      still != null &&
      still.x === view.x &&
      still.y === view.y &&
      still.width === view.width
    ) {
      return;
    }
    const cx = canvas.getContext('2d');
    if (cx == null) {
      return;
    }
    if (moving) {
      ambience.advance(deltaTimeSec);
    }
    ambience.paint(cx, view, width, height, !reducedMotion);
    this.stillAmbience = moving ? null : { ...view };
  }

  /**
   * Draws the minimap: the camera's frame on every frame, where the
   * colonies are ten times a second - enough to follow a fight.
   */
  private paintMinimap(view: Rect, dynamicWalls: readonly DynamicWall[]): void {
    if (this.minimap == null) {
      return;
    }
    const now = performance.now();
    if (now - this.minimapUpdatedAt >= MINIMAP_UPDATE_MS) {
      const simulation = this.playerService.getSimulation();
      const blocks = simulation.blockCounts();
      if (blocks != null) {
        this.minimap.update(
          blocks,
          simulation.summaries().map((colony) => colony.color)
        );
        this.minimapUpdatedAt = now;
      }
    }
    this.minimap.paint(view, dynamicWalls);
  }

  /**
   * Moves the camera over a big map - after the crosshair of the one human
   * in a match, to the whole arena otherwise - and returns what of the
   * arena the frame shows: all of it on a base map.
   */
  private moveCamera(): Rect {
    const { width, height } = this.stage.arena();
    if (this.camera == null) {
      return { x: 0, y: 0, width, height };
    }
    const now = performance.now();
    const deltaSec =
      this.cameraMovedAt == null
        ? 0
        : Math.min(0.1, (now - this.cameraMovedAt) / 1000);
    this.cameraMovedAt = now;
    const target = this.cameraTarget();
    this.camera.follow(target, deltaSec);
    if (this.camera.settledOn(target)) {
      // Its next move starts afresh, not with the time it sat still.
      this.cameraMovedAt = null;
    } else if (!this.matchPaints()) {
      // No match frame moves it on now - a finished match, a pause, the
      // start screen: it asks for frames itself until it arrives.
      this.stage.draw();
    }
    return this.camera.viewRect();
  }

  /** True while a running match paints every frame. */
  private matchPaints(): boolean {
    return untracked(this.stage.running) && !untracked(this.stage.paused);
  }

  /** What the camera follows: the one human's crosshair in a match. */
  private cameraTarget(): Point | null {
    const humans = untracked(this.stage.humans);
    return untracked(this.stage.running) && humans.length === 1
      ? this.playerService.crosshairAt(humans[0], 1)
      : null;
  }

  /** What the arena shows right now, for the painter. */
  private content(alpha: number): ArenaContent {
    const simulation = this.playerService.getSimulation();
    // Which processor runs the war - for the e2e tests and for debugging.
    // The match picks it, so it can fall back to the CPU after a GPU error.
    const dataset = this.stage.arenaView()?.canvas()?.dataset;
    if (dataset != null && dataset['simulation'] !== simulation.variant) {
      dataset['simulation'] = simulation.variant;
    }
    const players = untracked(this.playerStore.entities);
    return {
      ...arenaContent({
        players,
        crosshairAt: (player) => this.playerService.crosshairAt(player, alpha),
        simulation,
        walls: this.stage.walls(),
        balance: this.stage.balance(),
        looks: seatLooks(players, this.skin(), this.computerLook()),
        reducedMotion: this.stage.reducedMotion(),
        weaponFires: this.takeFires(),
        seatColors: this.seatColors,
        screenResolution: this.settings.value('screenResolution'),
      }),
      ambience:
        this.stage.painterAmbience() && this.settings.value('ambience')
          ? this.ambience
          : null,
    };
  }

  /** The weapons fired since the frame before - each goes into one frame. */
  private takeFires(): readonly WeaponFire[] {
    const fires = this.pendingFires;
    this.pendingFires = [];
    return fires;
  }

  /** The camera moved on, shaken while a match plays and a weapon goes off. */
  private shakenView(): Rect {
    const camera = this.moveCamera();
    this.lastCamera = camera;
    const { width, height } = this.stage.arena();
    return this.matchPaints()
      ? this.shake.shake(camera, width, height)
      : camera;
  }
}

/** An arena's size, "640×360" - the sharpness a device manages goes by it. */
function arenaKey(width: number, height: number): string {
  return `${width}×${height}`;
}
