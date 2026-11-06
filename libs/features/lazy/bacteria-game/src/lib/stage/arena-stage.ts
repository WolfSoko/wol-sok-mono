import {
  computed,
  ElementRef,
  inject,
  Injectable,
  signal,
  Signal,
  untracked,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import type { WsThanosDirective, WsThanosOptions } from '@wolsok/thanos';
import { ResizedEvent } from '@wolsok/ui-kit';
import { asapScheduler, firstValueFrom, Observable, of, timer } from 'rxjs';
import { filter, map, takeUntil, timeout } from 'rxjs/operators';
import { ArenaLayout, ArenaPainter, layoutKey } from '../arena/arena-painter';
import { ArenaTheme, arenaTheme, cssTriple } from '../arena/arena-theme';
import type { ArenaViewComponent } from '../arena/arena-view.component';
import { GlArenaPainter } from '../arena/gl/gl-arena-painter';
import { CampaignService } from '../campaign.service';
import { FeatureTogglesService } from '../feature-toggles.service';
import { fitInside, Size } from '../fullscreen';
import { GpuSelfTestService } from '../gl/gpu-self-test.service';
import { gpuTrusted } from '../gl/simulation-check';
import { chooseSimulation } from '../gl/simulation-choice';
import { SimulationOverrideService } from '../gl/simulation-override.service';
import { prefersReducedMotion } from '../reduced-motion';
import { GameSettingsService } from '../settings.service';
import { GameSoundService } from '../sound/game-sound.service';
import {
  arenaSize,
  detailScale,
  GameBalance,
  gridScale,
  levelBalance,
  levelMap,
  levelSize,
  mapZones,
  ONLINE_SIM_RESOLUTION,
  Player,
  Point,
  Rect,
  renderScale,
  SimResolution,
  simScale,
  Zone,
} from '@wolsok/feat-shared-bacteria-engine';
import { GameStateService } from '../state/game-state.service';
import { GameStateStore } from '../state/game.states';
import { PlayerService } from '../state/player.service';
import { PlayerStore } from '../state/player.store';
import { arenaPointFromClient } from '../touch-controls';
import { randomWindDirection, vaporizePixels } from '../vaporize-effect';

/**
 * The vaporize snap's volume at full effects. The game's effects are short
 * and quiet blips, the snap's wind and sand blow for the whole effect: at
 * this level they sit among the other effects instead of over them.
 */
const SNAP_LEVEL = 0.3;

/**
 * How much longer than the set length the vaporize effect - its capture
 * of the canvas included - may take before the stage goes on without it:
 * a snapshot that never completes must not leave the stage without a menu.
 */
const VAPORIZE_SLACK_MS = 5_000;

/** Room kept free around the arena for its frame, in CSS pixels. */
const ARENA_FRAME_PX = 6;

/** How long a match waits at most for the arena laid out for it. */
const ARENA_READY_MS = 2_000;

/**
 * What the arena stage takes from the component that hosts it: the parts
 * of its template, and whether a ranked attempt is being declared - which
 * already moves the war onto the online grid.
 */
export interface ArenaStageHost {
  arenaView: Signal<ArenaViewComponent | undefined>;
  ambienceCanvas: Signal<ElementRef<HTMLCanvasElement> | undefined>;
  minimapCanvas: Signal<ElementRef<HTMLCanvasElement> | undefined>;
  /**
   * The frame around the arena canvas, inside the vaporized container -
   * missing where the template is not rendered, as in the specs.
   */
  arenaFrame: () => ElementRef<HTMLElement> | undefined;
  /** The vaporize effect on the arena's container. */
  thanos: () => WsThanosDirective;
  declaring: Signal<boolean>;
}

/**
 * The arena on the stage: its size and layout on the canvas, the painter
 * the arena view built for it, the simulation it picks, and clearing it
 * with the vaporize effect. What a frame paints is `StageFrame`'s.
 * Provided by the stage component, which hands it its template with
 * {@link bind}.
 */
@Injectable()
export class ArenaStage {
  private readonly store = inject(GameStateStore);
  private readonly gameStateService = inject(GameStateService);
  private readonly playerService = inject(PlayerService);
  private readonly playerStore = inject(PlayerStore);
  private readonly settings = inject(GameSettingsService);
  private readonly sound = inject(GameSoundService);
  private readonly campaign = inject(CampaignService);
  private readonly gpuSelfTest = inject(GpuSelfTestService);
  private readonly simulationOverride = inject(SimulationOverrideService);
  private readonly featureToggles = inject(FeatureTogglesService).toggles;
  private readonly host = signal<ArenaStageHost | null>(null);

  /** True while a match is on, paused or not. */
  public readonly running = this.store.isMatchOn;
  public readonly paused = this.store.isPaused;
  /** No flickering glow for players who asked their system for less motion. */
  public readonly reducedMotion = prefersReducedMotion();
  /** The arena on its canvas, null before the template is bound. */
  public readonly arenaView = computed(() => this.host()?.arenaView());
  /** The canvas the ambience is drawn on, while the painter does not draw it. */
  public readonly ambienceCanvas = computed(() =>
    this.host()?.ambienceCanvas()
  );
  /** The minimap's canvas, while the camera follows a player. */
  public readonly minimapCanvas = computed(() => this.host()?.minimapCanvas());

  /** The crosshairs a finger or a key may steer - never the computer's. */
  public readonly humans: Signal<Player[]> = computed(() =>
    this.playerStore.entities().filter((player) => !player.isBot)
  );
  /**
   * The grid the war runs on: the setting, but online the one grid both
   * devices run - also under the result of a match the other device left,
   * which a new grid would wipe off the board - and the online grid too
   * for a ranked match (`rankedPlan`), from its declaration on.
   */
  private readonly simResolution = computed((): SimResolution =>
    !this.store.matchRules().onlineGrid &&
    this.store.endedBy() !== 'forfeit' &&
    !(this.host()?.declaring() ?? false)
      ? this.settings.simResolution()
      : ONLINE_SIM_RESOLUTION
  );
  /** How many times the base arena the level's map is along each side. */
  public readonly mapSize = computed(() => levelSize(this.store.level()));
  /**
   * The arena in cells, as fine as the simulation resolution asks for and
   * as big as the level's map.
   */
  public readonly arena = computed(() =>
    arenaSize(this.simResolution(), this.mapSize())
  );
  /** Balance of the selected level - drives both rendering and the scoreboard. */
  public readonly balance: Signal<GameBalance> = computed(() => {
    const level = this.store.level();
    return levelBalance(level, gridScale(level, this.arena().width));
  });
  /** Walls of the selected level, drawn every frame. */
  public readonly walls: Signal<Rect[]> = computed(() => {
    const { width, height } = this.arena();
    return levelMap(this.store.level()).createWalls(width, height);
  });
  /** Zones of the selected level, drawn under the walls. */
  public readonly zones: Signal<Zone[]> = computed(() => {
    const { width, height } = this.arena();
    return mapZones(levelMap(this.store.level()), width, height);
  });
  /** How the selected level looks and sounds. */
  public readonly theme: Signal<ArenaTheme> = computed(() =>
    arenaTheme(this.campaign.activeArena() ?? this.store.level().id)
  );
  /** The frame colour of the arena, as a CSS `rgb()` triple. */
  public readonly arenaBorder = computed(() => cssTriple(this.theme().border));
  /** The darkest floor colour of the arena, for the stage around it. */
  public readonly arenaRim = computed(() => cssTriple(this.theme().rim));
  /**
   * True while the camera shows part of a big map: in a match of one human -
   * with two, it shows the whole map. The minimap shows then, and the
   * camera zooms.
   */
  public readonly cameraFollows = computed(
    () => this.mapSize() > 1 && this.running() && this.humans().length === 1
  );
  /**
   * What the arena view lays its canvas out for: the arena at the
   * resolutions set. Either resolution changing hands the painter a fresh
   * canvas and context - as does the device override sending the war to
   * the GPU, which keeps WebGL2 even where the browser renders it on the
   * CPU.
   */
  public readonly arenaLayout = computed((): ArenaLayout => {
    const sim = this.simResolution();
    const screen = this.settings.screenResolution();
    const size = this.mapSize();
    return {
      ...this.arena(),
      scale: renderScale(sim, screen, size),
      detail: detailScale(sim, screen, size),
      unit: simScale(sim),
      softwareWebGl: this.simulationOverride.override() === 'gpu-int',
    };
  });
  /** The box around the canvas in CSS pixels, null before its first layout. */
  private readonly arenaBoxSize = signal<Size | null>(null);
  /**
   * Explicit canvas size: the largest box with the arena's aspect ratio that
   * fits the box around it. Null before the box was first laid out.
   *
   * Letting CSS scale the drawing inside a bigger element would work visually,
   * but the pointer maths maps a touch through the bounding rect of the canvas
   * - padding hidden in that rect would offset every crosshair drag.
   */
  public readonly canvasSize = computed(() => {
    const box = this.arenaBoxSize();
    // Leave room for the glowing frame around the arena.
    const frame = 2 * ARENA_FRAME_PX;
    return box != null
      ? fitInside(
          Math.max(0, box.width - frame),
          Math.max(0, box.height - frame),
          this.arena().width,
          this.arena().height
        )
      : null;
  });
  /** The layout the last painter was built for - null before the first. */
  private readonly painterLayout = signal<ArenaLayout | null>(null);
  /**
   * True once the arena view built its painter for the layout the arena
   * has now (one with the same canvas key: the layout is recomputed, a
   * new object, on every level) - or before it built any.
   */
  private readonly arenaReady = computed(() => {
    const painted = this.painterLayout();
    return (
      painted === null || layoutKey(painted) === layoutKey(this.arenaLayout())
    );
  });
  private readonly arenaReady$ = toObservable(this.arenaReady);

  /**
   * True while the painter draws the ambience with the arena - the stage
   * then lays no canvas of its own over it.
   */
  public readonly painterAmbience = signal(false);

  /**
   * The vaporize effect as set: as long as chosen, within the quality's
   * pixel budget - a big desktop window is snapped with
   * coarser particles - its snap as loud as the game's other effects, and
   * its dust blowing a new way each time.
   */
  public readonly thanosOptions = computed((): Partial<WsThanosOptions> => {
    const gain = this.sound.effectsGain();
    return {
      animationLength: this.settings.vaporizeMs(),
      maxCapturePixels: vaporizePixels(this.settings.vaporize()),
      sound: gain > 0,
      soundVolume: gain * SNAP_LEVEL,
      windDirection: this.windDirection(),
    };
  });
  /**
   * The next snap's wind. Rolled ahead of time: the effect reads its options
   * as it starts, before a new value could reach it through the binding.
   */
  private readonly windDirection = signal(randomWindDirection());

  /** Draws the arena - on the GPU where the browser can; the view builds it. */
  private painter: ArenaPainter | null = null;
  /** True while the arena frame is hidden, see {@link hideUntilPainted}. */
  private arenaHidden = false;
  /** True once the stage rendered what follows the effect, while hidden. */
  private stageRendered = false;
  /** True once the arena painted its next frame, while hidden. */
  private arenaPainted = false;

  /** Takes the template of the component that hosts the stage. */
  public bind(host: ArenaStageHost): void {
    this.host.set(host);
  }

  /** The template's parts, once bound. */
  private hostParts(): ArenaStageHost | null {
    return untracked(this.host);
  }

  /** The painter the arena view built, null before it built one. */
  public currentPainter(): ArenaPainter | null {
    return this.painter;
  }

  /**
   * Takes the painter the arena view built for a fresh canvas - null right
   * before it lets go of the one before - and tells whether there is one.
   */
  public takePainter(painter: ArenaPainter | null): painter is ArenaPainter {
    this.painter = painter;
    this.painterAmbience.set(painter?.paintsAmbience === true);
    if (painter == null) {
      // The GPU simulation lives in the old context: let it go while it lasts.
      this.playerService.useSimulation(null);
      return false;
    }
    this.painterLayout.set(untracked(this.arenaLayout));
    return true;
  }

  /**
   * Picks the simulation for the arena the painter was built for: with a
   * WebGL2 context the war itself runs on the GPU as well - for a
   * deterministic match only once the GPU passed the self-test.
   * Resolutions only change between matches, so the colonies are simply
   * spawned again on the new grid.
   */
  public chooseSimulationFor(painter: ArenaPainter): void {
    const gl = painter instanceof GlArenaPainter ? painter : null;
    if (gl != null) {
      this.gpuSelfTest.sawRenderer(gl.renderer());
    }
    const choice = chooseSimulation({
      // The owner's toggle, read as each match starts: Remote Config may
      // answer after the arena is up, and a match keeps its simulation.
      deterministic: () =>
        untracked(() => this.featureToggles().deterministicSimulation),
      gpu:
        gl == null
          ? null
          : (balance, random, options) =>
              gl.createSimulation(balance, random, options),
      gpuTrusted: () => gpuTrusted(this.gpuSelfTest.result()),
      override: this.simulationOverride.override,
    });
    this.playerService.useSimulation(choice.factory, choice.fallback, choice);
    const { width, height } = this.arena();
    this.gameStateService.setArenaSize(width, height);
  }

  /**
   * Remembers the size of the box around the canvas, which the stage
   * fits the canvas into - see {@link canvasSize}.
   */
  public onArenaBoxResized(event: ResizedEvent): void {
    this.arenaBoxSize.set({ width: event.newWidth, height: event.newHeight });
  }

  /**
   * Waits until the arena is laid out for the next match: a ranked match
   * plays the online grid, whose canvas the arena view builds a moment
   * after the grid changed. Waits a little at most.
   */
  public async whenReady(): Promise<void> {
    if (untracked(this.arenaReady)) {
      return;
    }
    await firstValueFrom(
      this.arenaReady$.pipe(
        filter(Boolean),
        timeout({ first: ARENA_READY_MS, with: () => of(true) })
      )
    );
  }

  /**
   * Paints the arena as it stands, on the next animation frame, without
   * advancing the war - whenever it changes while nobody is playing.
   */
  public draw(): void {
    if (this.painter != null) {
      this.arenaView()?.repaint();
    }
  }

  /**
   * Turns the last frame to dust, completing once the effect is over - at
   * the set length plus some slack at the latest.
   */
  public vaporize(): Observable<void> {
    // Never a snapshot of a hidden arena, see hideUntilPainted.
    this.revealArena();
    // Switched off, the arena simply clears - still after the caller is
    // through, as it would after the effect.
    if (this.settings.vaporize() === 'off') {
      return timer(0, asapScheduler).pipe(map(() => undefined));
    }
    // The effect takes its snapshot of the canvas right away.
    this.painter?.showLastFrame();
    // Should the capture or the effect never end, the stage goes on
    // without them rather than staying without a menu. The cold `vaporize$`
    // runs the effect on this subscription, so leaving it at the deadline
    // cancels the effect: a capture that only finishes later must not dim
    // the container and lay its canvas over the menu or the next match.
    // The directive's teardown fades the container back in.
    // vaporize$ reads its options as it is called: this snap has its wind,
    // the next one blows another way.
    const host = this.hostParts();
    if (host == null) {
      throw new Error('The arena stage has no host to vaporize');
    }
    const vaporized = host
      .thanos()
      .vaporize$(false)
      .pipe(
        takeUntil(timer(this.settings.vaporizeMs() + VAPORIZE_SLACK_MS)),
        map(() => undefined)
      );
    this.windDirection.set(randomWindDirection());
    return vaporized;
  }

  /**
   * Takes the arena frame out of sight until the stage shows what comes
   * next - the reset arena under the menu screen, or the next match's
   * first frame.
   *
   * The vaporize directive fades its container back in by itself at the end
   * of the effect, before the reset ran and before the menu screen is
   * rendered, which on a slow device takes a while: the old level would
   * show between the dust and the menu. Hidden here, synchronously as the
   * effect ends, the frame comes back only once both the stage rendered
   * what follows ({@link stageRenderedAfterReset}) and the arena painted its
   * next frame ({@link arenaPaintedAfterReset}, inside the animation frame): the
   * repaint lands on the next frame, often ahead of a slow change
   * detection, so a paint alone would show the old level still.
   * {@link vaporize} reveals the frame regardless, so no snapshot is taken
   * of a hidden arena.
   */
  public hideUntilPainted(): void {
    const frame = this.hostParts()?.arenaFrame()?.nativeElement;
    if (frame == null) {
      return;
    }
    frame.style.visibility = 'hidden';
    this.arenaHidden = true;
    this.stageRendered = false;
    this.arenaPainted = false;
  }

  /** The stage rendered what follows the effect: one of the two waits over. */
  public stageRenderedAfterReset(): void {
    this.stageRendered = true;
    this.revealArenaWhenReady();
  }

  /** The arena painted a frame: the other wait over. */
  public arenaPaintedAfterReset(): void {
    this.arenaPainted = true;
    this.revealArenaWhenReady();
  }

  /**
   * Shows the hidden arena frame once both the render and the paint are
   * through, see {@link hideUntilPainted}. Called every frame, so it costs
   * a boolean check while the frame is shown.
   */
  private revealArenaWhenReady(): void {
    if (!this.arenaHidden || !this.stageRendered || !this.arenaPainted) {
      return;
    }
    this.revealArena();
  }

  /** Shows the arena frame, whatever it still waits for. */
  private revealArena(): void {
    this.arenaHidden = false;
    const frame = this.hostParts()?.arenaFrame()?.nativeElement;
    if (frame != null) {
      frame.style.visibility = '';
    }
  }

  /** The point of the arena under the pointer, null without a canvas. */
  public arenaPoint(event: PointerEvent): Point | null {
    const view = this.arenaView();
    const canvas = view?.canvas();
    if (view == null || canvas == null) {
      return null;
    }
    return arenaPointFromClient(
      event.clientX,
      event.clientY,
      canvas.getBoundingClientRect(),
      view.shownView() ?? { x: 0, y: 0, ...this.arena() }
    );
  }
}
