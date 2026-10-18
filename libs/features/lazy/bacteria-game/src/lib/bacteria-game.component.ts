import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  Signal,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { WsThanosDirective } from '@wolsok/thanos';
import {
  ElemResizedDirective,
  ResizedEvent,
  ShowFpsComponent,
} from '@wolsok/ui-kit';
import { defer, fromEvent, Observable } from 'rxjs';
import {
  defaultIfEmpty,
  distinctUntilChanged,
  last,
  map,
  switchMap,
  take,
  tap,
} from 'rxjs/operators';
import { ArenaFrame, ArenaPainter } from './arena/arena-painter';
import { createArenaPainter } from './arena/create-arena-painter';
import { GlArenaPainter } from './arena/gl/gl-arena-painter';
import { ArenaTheme, arenaTheme, cssTriple } from './arena/arena-theme';
import { BoostPadComponent } from './boost-pad/boost-pad.component';
import {
  exitFullscreen,
  fitInside,
  isFullscreen,
  isFullscreenSupported,
  lockLandscape,
  requestFullscreen,
  Size,
  unlockOrientation,
} from './fullscreen';
import { JoystickComponent } from './joystick/joystick.component';
import {
  ColorChange,
  MatchSetupComponent,
} from './match-setup/match-setup.component';
import { DEFAULT_COLORS, getColonyColor } from './state/colony-colors';
import {
  BOT_DIFFICULTIES,
  BotDifficulty,
  DEFAULT_DIFFICULTY,
} from './state/bot-controller';
import { BACTERIA_LOOKS, GameSettingsService } from './settings.service';
import {
  arenaSize,
  renderScale,
  SCREEN_RESOLUTIONS,
  scaleOf,
  SIM_RESOLUTIONS,
} from './state/arena-size';
import { GameSoundService, MatchResult } from './sound/game-sound.service';
import { levelMusic } from './sound/level-music';
import { arenaPointFromClient, nearestFreeCrosshair } from './touch-controls';
import {
  boostLabel,
  ColonyStats,
  humanForBoostKey,
  toColonyStats,
} from './colony-stats';
import { GameBalance } from './state/game-balance';
import { SteeringVector } from './state/geometry';
import { GameStateQuery } from './state/game-state.query';
import { GameStateService } from './state/game-state.service';
import {
  DEFAULT_MODE,
  GameMode,
  GameState,
  GameStateState,
} from './state/game.states';
import {
  Level,
  LEVELS,
  levelBalance,
  levelMap,
  nextLevel,
} from './state/levels';
import { Rect } from './state/maps';
import { isBoosted, Player } from './state/player.model';
import { PlayerQuery } from './state/player.query';
import { PlayerService } from './state/player.service';
import {
  MatchEndAction,
  WinnerComponent,
} from './winner-info/winner.component';

@UntilDestroy()
@Component({
  imports: [
    CommonModule,
    MatCardModule,
    WsThanosDirective,
    MatButtonModule,
    MatProgressSpinnerModule,
    ShowFpsComponent,
    MatToolbarModule,
    MatIconModule,
    MatTooltipModule,
    MatchSetupComponent,
    JoystickComponent,
    BoostPadComponent,
    ElemResizedDirective,
    WinnerComponent,
    MatButtonToggleModule,
    MatSlideToggleModule,
  ],
  templateUrl: './bacteria-game.component.html',
  styleUrls: ['./bacteria-game.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BacteriaGameComponent implements AfterViewInit, OnDestroy {
  private query = inject(GameStateQuery);
  private gameStateService = inject(GameStateService);
  private playerService = inject(PlayerService);
  private playerQuery = inject(PlayerQuery);
  protected readonly settings = inject(GameSettingsService);
  private readonly sound = inject(GameSoundService);
  /** No flickering glow for players who asked their system for less motion. */
  private readonly reducedMotion = prefersReducedMotion();

  /**
   * The canvas the arena is drawn on. A new resolution gets a new canvas -
   * see {@link canvasKey} - which is when the painter is built again.
   */
  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>('canvasElement');
  @ViewChild('arenaStage', { static: true })
  private stageRef!: ElementRef<HTMLElement>;
  @ViewChild(WsThanosDirective, { static: true })
  private thanos!: WsThanosDirective;
  /** Draws the arena - on the GPU where the browser can. */
  private painter: ArenaPainter | null = null;
  /** Lay the next frame's floor down fully instead of fading into a trail. */
  private clearNextFrame = true;

  /** The arena in cells, as fine as the simulation resolution asks for. */
  protected readonly arena = computed(() =>
    arenaSize(this.settings.simResolution())
  );
  /**
   * One key per pair of resolutions: the canvas is rendered for the key, so
   * either resolution changing hands the painter a fresh canvas and context.
   */
  protected readonly canvasKey = computed(() => [
    `${this.settings.simResolution()}:${this.settings.screenResolution()}`,
  ]);
  protected readonly simResolutions = SIM_RESOLUTIONS;
  protected readonly screenResolutions = SCREEN_RESOLUTIONS;

  state: Signal<GameStateState | undefined>;
  stats: Signal<ColonyStats[]>;
  /** The colonies a finger may steer - one seat each in the touch layout. */
  protected readonly humanStats: Signal<ColonyStats[]>;
  fps$: Observable<number>;
  /** True while a match is on, paused or not. */
  protected readonly running: Signal<boolean>;
  protected readonly paused: Signal<boolean>;
  /** Whole seconds of match time, so the clock only re-renders once a second. */
  protected readonly gameSeconds: Signal<number>;
  /** True once a match is over and its result is shown, until the next one. */
  protected readonly matchOver: Signal<boolean>;
  /** The name of the computer's difficulty, for the menu's summary line. */
  protected readonly difficultyName: Signal<string>;
  protected readonly boostLabel = boostLabel;

  /**
   * Which of the menu screens is open while no match runs - and, while one
   * is paused, whether the settings are open on top of the pause menu.
   */
  protected readonly screen = signal<MenuScreen>('menu');
  /**
   * True while the arena is being cleared after a match: the state passes
   * through "paused" then, which is not a pause the player asked for.
   */
  private readonly resetting = signal(false);
  /**
   * The panel laid over the arena: the match result, the pause menu, one of
   * the menu screens - or none, while a match is on.
   */
  protected readonly panel = computed<StagePanel>(() => {
    if (this.resetting()) {
      return null;
    }
    if (this.matchOver()) {
      return 'over';
    }
    if (this.paused()) {
      return this.screen() === 'settings' ? 'settings' : 'pause';
    }
    return this.running() ? null : this.screen();
  });
  /** True while the browser shows the stage on the whole screen. */
  protected readonly nativeFullscreen = signal(false);
  /** False where the browser has no Fullscreen API, as on iPhones. */
  protected readonly nativeFullscreenSupported = signal(false);

  /** The level the next match is played on. */
  protected readonly level: Signal<Level>;
  /** Balance of the selected level - drives both rendering and the scoreboard. */
  protected readonly balance: Signal<GameBalance>;
  /** Walls of the selected level, drawn every frame. */
  protected readonly walls: Signal<Rect[]>;
  /** How the selected level looks and sounds. */
  protected readonly theme: Signal<ArenaTheme>;
  /** The frame colour of the arena, as a CSS `rgb()` triple. */
  protected readonly arenaBorder: Signal<string>;
  /** The darkest floor colour of the arena, for the stage around it. */
  protected readonly arenaRim: Signal<string>;
  /** Seconds of animation, for the wobble of the jam and the boost shimmer. */
  private animationSec = 0;
  /** The level that follows the selected one, null at the end of the list. */
  protected readonly upcomingLevel: Signal<Level | null>;
  /** Two humans or one human against the computer. */
  protected readonly mode: Signal<GameMode>;
  /** How hard the computer plays. */
  protected readonly difficulty: Signal<BotDifficulty>;
  /** The colour ids of the left and the right colony. */
  protected readonly colors: Signal<[string, string]>;
  /** The names of the left and the right colour, for the help texts. */
  protected readonly colorNames = computed(() =>
    this.colors().map((id) => getColonyColor(id).name)
  );
  /** The looks the bacteria can be drawn in. */
  protected readonly looks = BACTERIA_LOOKS;
  /** The crosshairs a finger or a key may steer - never the computer's. */
  private readonly humans: Signal<Player[]>;

  /**
   * True while the arena fills the screen: the touch layout with a seat per
   * player, laid over the whole viewport. The page opens this way - a phone
   * between two players has no room for a page around the game.
   *
   * This is the component's own layout and works everywhere. On top of it the
   * browser's Fullscreen API is used where it exists, to hide the browser
   * chrome as well - see {@link requestNativeFullscreen}.
   */
  protected readonly fullscreen = signal(true);
  /** The box around the canvas in CSS pixels, null before its first layout. */
  private readonly arenaBoxSize = signal<Size | null>(null);
  /**
   * Explicit canvas size while fullscreen: the largest box with the arena's
   * aspect ratio that fits the box around it. Null while the normal layout
   * sizes the canvas by CSS.
   *
   * Letting CSS scale the drawing inside a bigger element would work visually,
   * but the pointer maths maps a touch through the bounding rect of the canvas
   * - padding hidden in that rect would offset every crosshair drag.
   */
  protected readonly canvasSize = computed(() => {
    const box = this.arenaBoxSize();
    // Leave room for the glowing frame around the arena.
    const frame = 2 * ARENA_FRAME_PX;
    return this.fullscreen() && box != null
      ? fitInside(
          Math.max(0, box.width - frame),
          Math.max(0, box.height - frame),
          this.arena().width,
          this.arena().height
        )
      : null;
  });

  /** Which crosshair each active pointer is dragging: pointerId -> playerId. */
  private readonly draggedBy = new Map<number, number>();

  constructor() {
    this.state = toSignal(this.query.select());
    this.fps$ = this.query.selectFps();
    this.gameStateService.reset();

    this.level = toSignal(this.query.selectLevel(), {
      initialValue: LEVELS[0],
    });
    this.balance = computed(() =>
      levelBalance(this.level(), scaleOf(this.arena().width))
    );
    this.walls = computed(() => {
      const { width, height } = this.arena();
      return levelMap(this.level()).createWalls(width, height);
    });
    this.upcomingLevel = computed(() => nextLevel(this.level().id));
    this.theme = computed(() => arenaTheme(this.level().id));
    this.arenaBorder = computed(() => cssTriple(this.theme().border));
    this.arenaRim = computed(() => cssTriple(this.theme().rim));

    this.mode = toSignal(this.query.selectMode(), {
      initialValue: DEFAULT_MODE,
    });
    this.colors = toSignal(this.query.selectColors(), {
      initialValue: [DEFAULT_COLORS[0], DEFAULT_COLORS[1]] as [string, string],
    });
    this.difficulty = toSignal(this.query.selectDifficulty(), {
      initialValue: DEFAULT_DIFFICULTY,
    });

    const players = toSignal(this.playerQuery.selectAll(), {
      initialValue: [] as Player[],
    });
    this.humans = computed(() => players().filter((player) => !player.isBot));
    this.stats = computed(() => toColonyStats(players(), this.balance()));
    this.humanStats = computed(() =>
      this.stats().filter((colony) => !colony.isBot)
    );

    // Repaint as soon as another level puts different walls into the arena, or
    // the colonies change colour or look, so the start screen always shows
    // the map and the colonies the next match is fought with. A clear frame
    // also wipes the glow from the trail once the player asks for less
    // motion, even while the game is paused.
    effect(() => {
      this.painter?.setTheme(this.theme());
      this.walls();
      this.colors();
      this.settings.look();
      this.reducedMotion();
      this.draw(1 / 1000, true);
    });

    // A fresh canvas - the first one, or one for another resolution - gets a
    // painter of its own.
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas != null) {
        untracked(() => this.attachPainter(canvas));
      }
    });

    this.running = toSignal(this.query.selectIsMatchOn(), {
      initialValue: false,
    });
    this.paused = toSignal(this.query.selectIsPaused(), {
      initialValue: false,
    });
    this.gameSeconds = toSignal(
      this.query
        .select((state) => Math.floor(state.timePassed / 1000))
        .pipe(distinctUntilChanged()),
      { initialValue: 0 }
    );
    this.matchOver = toSignal(this.query.selectMatchEnded(), {
      initialValue: false,
    });
    effect(() => this.sound.setEnabled(this.settings.sound()));
    effect(() => this.sound.setMusicEnabled(this.settings.music()));
    // The level's music plays while the match is on and stops on pause. A
    // resumed match picks it up where the match clock stands, so it stays
    // in step with a map that moves to it.
    effect(() => {
      const music =
        this.running() && !this.paused() ? levelMusic(this.level().id) : null;
      untracked(() =>
        this.sound.setMusic(music, this.query.getValue().timePassed / 1000)
      );
    });
    effect(() => {
      if (this.matchOver()) {
        untracked(() => this.sound.matchEnd(this.matchResult()));
      }
    });

    this.difficultyName = computed(
      () =>
        BOT_DIFFICULTIES.find((option) => option.id === this.difficulty())
          ?.name ?? ''
    );

    this.query
      .selectTimeDelta()
      .pipe(untilDestroyed(this))
      .subscribe((deltaTimeMs) => {
        const dTSec = deltaTimeMs / 1000;
        this.draw(Math.min(dTSec, 0.1));
      });
  }

  /**
   * Clears the arena after a match and, unless the player heads back to the
   * menu, kicks off the next one right away - on the following level for
   * "next level".
   */
  protected onMatchEnd(action: MatchEndAction): void {
    const next = action === 'next' ? this.upcomingLevel() : null;
    this.screen.set('menu');
    this.resetGame$()
      .pipe(
        tap(() => {
          // Only once the old arena has turned to dust: switched before, the
          // next level would flash up just to be vaporized with the old one.
          if (next != null) {
            this.gameStateService.setLevel(next.id);
          }
          if (action !== 'menu') {
            this.startGame();
          }
        }),
        untilDestroyed(this)
      )
      .subscribe();
  }

  /**
   * How the match ended for the people at the screen: against the computer a
   * win or a loss, between two players always a win for one of them.
   */
  private matchResult(): MatchResult {
    const winner = this.query.getValue().winner;
    if (winner == null) {
      return 'draw';
    }
    return winner.isBot ? 'loss' : 'win';
  }

  /** Turns the sound on or off, and remembers it. */
  protected setSound(on: boolean): void {
    this.settings.setSound(on);
    if (on) {
      this.sound.click();
    }
  }

  /** Opens one of the menu screens. */
  protected show(screen: MenuScreen): void {
    this.screen.set(screen);
  }

  /** Gives the match up and returns to the main menu. */
  protected quitToMenu(): void {
    this.screen.set('menu');
    this.resetGame();
  }

  /** Puts the stage on the browser's whole screen, or takes it off again. */
  protected setNativeFullscreen(on: boolean): void {
    if (on) {
      this.requestNativeFullscreen();
    } else {
      exitFullscreen(document);
    }
  }

  ngAfterViewInit(): void {
    this.nativeFullscreenSupported.set(
      isFullscreenSupported(document, this.stageRef?.nativeElement)
    );
    this.requestNativeFullscreenOnOpen();
  }

  /**
   * Builds the painter for a fresh canvas, at the resolutions it was rendered
   * for, and lets go of the one before. Resolutions only change between
   * matches, so the colonies are simply spawned again on the new grid.
   */
  private attachPainter(canvas: HTMLCanvasElement): void {
    // The GPU simulation lives in the old context: let it go while it lasts.
    this.playerService.useSimulation(null);
    this.painter?.dispose();
    const { width, height } = this.arena();
    this.painter = createArenaPainter(
      canvas,
      width,
      height,
      renderScale(
        this.settings.simResolution(),
        this.settings.screenResolution()
      )
    );
    if (this.painter == null) {
      throw new Error('Could not get rendering context');
    }
    // Which painter runs - for the e2e tests and for anyone debugging.
    canvas.dataset['renderer'] = this.painter.kind;
    // With a WebGL2 context the war itself runs on the GPU as well.
    const gl = this.painter instanceof GlArenaPainter ? this.painter : null;
    this.playerService.useSimulation(
      gl == null ? null : (balance) => gl.createSimulation(balance)
    );
    this.painter.setTheme(this.theme());
    this.gameStateService.setArenaSize(width, height);
    this.draw(1 / 1000, true);
  }

  /**
   * Clears the arena and starts a fresh match. The tap on Start is the one
   * gesture nearly every session makes, so it also takes the screen.
   */
  startGame() {
    this.requestNativeFullscreen();
    this.sound.matchStart();
    this.clearNextFrame = true;
    this.gameStateService.cleanup();
    this.gameStateService.init(this.arena().width, this.arena().height);
    this.gameStateService.start();
  }

  private vaporize(): Observable<void> {
    return this.thanos.vaporize(false).pipe(take(1));
  }

  /** Pauses, vaporizes the canvas and returns to the start screen. */
  resetGame() {
    this.resetGame$().pipe(untilDestroyed(this)).subscribe();
  }

  /**
   * Pauses, vaporizes the canvas and returns to the start screen, completing
   * once the arena is clear again.
   *
   * The animation is allowed to finish without emitting - what matters is that
   * it is over, so the reset hangs off the completion rather than off a value.
   */
  private resetGame$(): Observable<void> {
    return defer(() => {
      this.resetting.set(true);
      this.gameStateService.pause();
      return this.query.selectCurrentGameState(GameState.PAUSED).pipe(
        take(1),
        switchMap(() => this.vaporize()),
        defaultIfEmpty(undefined),
        last(),
        tap(() => {
          this.gameStateService.reset();
          this.draw(1 / 1000, true);
          this.resetting.set(false);
        }),
        map(() => undefined)
      );
    });
  }

  /**
   * Advances the simulation by one frame and renders the arena.
   *
   * `clear` wipes the previous frame instead of fading it. A single frame is
   * drawn whenever the arena changes while nobody is playing, and the fade
   * alone would leave the walls of the last map as ghosts on the canvas.
   */
  private draw(deltaTimeInSec: number, clear = false) {
    if (this.painter == null) {
      return;
    }
    const isRunning = this.query.getValue().currentState === GameState.RUNNING;

    requestAnimationFrame(() => {
      if (isRunning) {
        const { width, height } = this.arena();
        this.playerService.gameLoop(width, height, deltaTimeInSec);
        this.sound.frame(this.playerService.getFrameEvents());
      }
      this.animationSec += deltaTimeInSec;
      const frame = this.frame(deltaTimeInSec, clear || this.clearNextFrame);
      this.clearNextFrame = false;
      this.painter?.paint(frame);
    });
  }

  /** What the arena shows right now, for the painter. */
  private frame(deltaTimeSec: number, clear: boolean): ArenaFrame {
    const balance = this.balance();
    const players = this.playerQuery.getAll();
    const boosted = new Set(
      players.filter(isBoosted).map((player) => player.id)
    );
    const simulation = this.playerService.getSimulation();
    // Which processor runs the war - for the e2e tests and for debugging.
    // The match picks it, so it can fall back to the CPU after a GPU error.
    const dataset = this.canvasRef()?.nativeElement.dataset;
    if (dataset != null && dataset['simulation'] !== simulation.kind) {
      dataset['simulation'] = simulation.kind;
    }
    return {
      clear,
      deltaTimeSec,
      timeSec: this.animationSec,
      walls: this.walls(),
      dynamicWalls: this.playerService.getDynamicWalls(),
      colonies: simulation.colonyLayers(boosted),
      reducedMotion: this.reducedMotion(),
      nutrients: this.playerService.getNutrients(),
      balance,
      look: this.settings.look(),
      cursors: players.map((player) => ({
        x: player.x,
        y: player.y,
        color: player.color,
        boostLeft:
          isBoosted(player) && balance.boostDurationSec > 0
            ? player.boostActiveSec / balance.boostDurationSec
            : null,
      })),
    };
  }

  ngOnDestroy(): void {
    this.gameStateService.cleanup();
    // The GPU simulation lives in this canvas's context, which goes with it.
    this.playerService.useSimulation(null);
    this.painter?.dispose();
    this.sound.setMusic(null);
    // Leaving the page must give the screen back as well.
    exitFullscreen(document);
    unlockOrientation(screen);
  }

  /** Toggles pause - the touch equivalent of the P key. */
  togglePause() {
    this.requestNativeFullscreen();
    this.sound.click();
    this.gameStateService.togglePause();
  }

  /** Picks the level the next match is played on. */
  protected selectLevel(levelId: string): void {
    this.gameStateService.setLevel(levelId);
  }

  /** Switches between two humans and human versus computer. */
  protected selectMode(mode: GameMode): void {
    this.gameStateService.setMode(mode);
  }

  /** Gives a seat's colony another colour. */
  protected selectColor(change: ColorChange): void {
    this.gameStateService.setColor(change.seat, change.colorId);
  }

  /** Picks how hard the computer plays. */
  protected selectDifficulty(difficulty: BotDifficulty): void {
    this.gameStateService.setDifficulty(difficulty);
  }

  /** Fires a player's boost - the button equivalent of Space / Enter. */
  protected boost(playerId: number): void {
    this.gameStateService.boost(playerId);
  }

  /** Pushes or releases a player's on-screen joystick. */
  protected steer(playerId: number, vector: SteeringVector): void {
    this.playerService.setSteering(playerId, vector);
  }

  /**
   * Lays the arena over the whole viewport and asks the browser for its
   * fullscreen on top. Called from a gesture - the button or the F key -
   * where the browser grants the request.
   */
  protected enterFullscreen(): void {
    this.fullscreen.set(true);
    this.requestNativeFullscreen();
  }

  /**
   * The page opens in the layout already (see {@link fullscreen}); this asks
   * for the browser's fullscreen on top. Without a gesture to spend the
   * browser would refuse and log an error, so the request is only made while
   * one is still fresh - after a navigation started by a click - and otherwise
   * left to the next gesture the game owns: Start, resume, F or the button.
   */
  private requestNativeFullscreenOnOpen(): void {
    if (navigator.userActivation?.isActive) {
      this.requestNativeFullscreen();
    }
  }

  /** Brings the arena back into the page. */
  protected leaveFullscreen(): void {
    this.fullscreen.set(false);
    exitFullscreen(document);
  }

  /**
   * Asks the browser to put the stage on the whole screen, once a request
   * stands a chance: only while the layout is up, not without the API, and
   * not while the stage is on the screen already. A refusal costs nothing -
   * the next gesture asks again.
   */
  private requestNativeFullscreen(): void {
    const stage = this.stageRef?.nativeElement;
    if (
      !this.fullscreen() ||
      !isFullscreenSupported(document, stage) ||
      this.isNativeFullscreen()
    ) {
      return;
    }
    void requestFullscreen(stage);
  }

  /** True while the browser shows the stage, and nothing else, on the screen. */
  private isNativeFullscreen(): boolean {
    return isFullscreen(document, this.stageRef?.nativeElement ?? undefined);
  }

  /**
   * Follows the browser both ways. Once it puts the stage on the screen, the
   * layout is up as well: a request granted late, after the layout was left,
   * must not leave a bare stage on the screen. Native fullscreen also locks
   * a phone into landscape, where the arena and the two seats fit.
   *
   * Once it takes the stage off - Escape, the back gesture, a system dialog,
   * the settings toggle - the game reacts as it does to Escape, which the
   * browser consumes before it reaches {@link onKeyDown}: a running match
   * pauses, a screen stays open, and only the main menu leaves for the page.
   */
  @HostListener('document:fullscreenchange')
  @HostListener('document:webkitfullscreenchange')
  protected onFullscreenChange(): void {
    const native = this.isNativeFullscreen();
    this.nativeFullscreen.set(native);
    if (native) {
      this.fullscreen.set(true);
      void lockLandscape(screen);
      return;
    }
    unlockOrientation(screen);
    if (this.running() && !this.paused()) {
      this.gameStateService.togglePause();
    } else if (this.panel() === 'menu') {
      this.leaveFullscreen();
    }
  }

  /**
   * Remembers the size of the box around the canvas, which the touch layout
   * fits the canvas into - see {@link canvasSize}.
   */
  protected onArenaBoxResized(event: ResizedEvent): void {
    this.arenaBoxSize.set({ width: event.newWidth, height: event.newHeight });
  }

  /**
   * Grabs the crosshair nearest to the touch and starts dragging it.
   *
   * Two pointers can be active at once, one per player, so both can play on the
   * same screen.
   */
  onPointerDown(event: PointerEvent) {
    const point = this.toArenaPoint(event);
    if (point == null) {
      return;
    }
    const playerId = nearestFreeCrosshair(
      this.humans(),
      point,
      new Set(this.draggedBy.values())
    );
    if (playerId == null) {
      return;
    }
    this.draggedBy.set(event.pointerId, playerId);
    // Keep receiving moves once the finger slides off the canvas.
    (event.target as Element).setPointerCapture?.(event.pointerId);
    this.playerService.setDragTarget(playerId, point.x, point.y);
    event.preventDefault();
  }

  onPointerMove(event: PointerEvent) {
    const playerId = this.draggedBy.get(event.pointerId);
    if (playerId == null) {
      return;
    }
    const point = this.toArenaPoint(event);
    if (point == null) {
      return;
    }
    this.playerService.setDragTarget(playerId, point.x, point.y);
    event.preventDefault();
  }

  /**
   * Releases the crosshair so another finger can grab it. The target itself
   * stays, so the crosshair finishes travelling to where the finger left it.
   */
  onPointerUp(event: PointerEvent) {
    this.draggedBy.delete(event.pointerId);
  }

  private toArenaPoint(event: PointerEvent) {
    const canvas = this.canvasRef()?.nativeElement;
    if (canvas == null) {
      return null;
    }
    return arenaPointFromClient(
      event.clientX,
      event.clientY,
      canvas.getBoundingClientRect(),
      this.arena().width,
      this.arena().height
    );
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown($event: KeyboardEvent) {
    if (isTypingTarget($event.target)) {
      return;
    }
    // F is handled here rather than in the store: the fullscreen request has
    // to happen inside the key event, browsers reject it otherwise.
    if ($event.key.toLowerCase() === 'f' && !$event.repeat) {
      if (this.fullscreen()) {
        this.leaveFullscreen();
      } else {
        this.enterFullscreen();
      }
      return;
    }
    // Escape, as in any game: pauses a match, backs out of a screen, and
    // only from the main menu leaves the layout for the page. The browser
    // takes its own fullscreen off on Escape before this runs.
    if ($event.key === 'Escape') {
      this.onEscape();
      return;
    }
    // The boost keys belong to the game only while a match is on, and never
    // while a button has the focus: a keyboard user pressing Enter on "Reset"
    // expects a reset, not a boost. Outside of a match Space still scrolls.
    const boosted =
      this.query.getValue().currentState === GameState.RUNNING &&
      !isInteractiveTarget($event.target)
        ? humanForBoostKey(this.humans(), $event.key)
        : null;
    if (boosted != null) {
      // Space would scroll the page.
      $event.preventDefault();
      if (!$event.repeat) {
        this.boost(boosted.id);
      }
      return;
    }
    this.gameStateService.addKeyPress($event.key);
  }

  @HostListener('document:keyup', ['$event'])
  onKeyUp($event: KeyboardEvent) {
    this.gameStateService.removeKeyPress($event.key);
  }

  private onEscape(): void {
    if (this.matchOver() || this.resetting()) {
      return;
    }
    if (this.running() && !this.paused()) {
      this.togglePause();
    } else if (this.screen() !== 'menu') {
      this.screen.set('menu');
    } else if (this.paused()) {
      this.togglePause();
    } else {
      this.leaveFullscreen();
    }
  }
}

/** Room kept free around the arena for its frame, in CSS pixels. */
const ARENA_FRAME_PX = 6;

/** The screens of the menu that is shown while no match is on. */
export type MenuScreen = 'menu' | 'settings' | 'help';

/** What is laid over the arena right now, nothing while a match is on. */
export type StagePanel = MenuScreen | 'pause' | 'over' | null;

/**
 * True while the key went to a control rather than to the game.
 *
 * Anything inside an overlay counts too: the level picker is a combobox whose
 * panel lives in the CDK overlay container, and typing a level name there must
 * not throw the page into fullscreen.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (element == null || typeof element.closest !== 'function') {
    return false;
  }
  return (
    element.isContentEditable ||
    element.closest(
      'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="option"], .cdk-overlay-container'
    ) != null
  );
}

/**
 * True while the key went to a focused control that Space or Enter activates,
 * such as a button or a toggle. A disabled control cannot be activated, so a
 * key pressed on it still belongs to the game - the Start button keeps the
 * focus after it kicked off the match and gets disabled.
 */
function isInteractiveTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (element == null || typeof element.closest !== 'function') {
    return false;
  }
  const control = element.closest<HTMLElement>(
    'button, a[href], [role="button"], [role="radio"], [role="checkbox"], [role="switch"], [role="tab"], [role="menuitem"]'
  );
  if (control == null) {
    return false;
  }
  return !(
    (control as HTMLButtonElement).disabled ||
    control.getAttribute('aria-disabled') === 'true'
  );
}

/** Whether the system asks for less motion - following it as it changes. */
function prefersReducedMotion(): Signal<boolean> {
  if (typeof matchMedia !== 'function') {
    return signal(false);
  }
  const query = matchMedia('(prefers-reduced-motion: reduce)');
  return toSignal(
    fromEvent<MediaQueryListEvent>(query, 'change').pipe(
      map((event) => event.matches)
    ),
    { initialValue: query.matches }
  );
}
