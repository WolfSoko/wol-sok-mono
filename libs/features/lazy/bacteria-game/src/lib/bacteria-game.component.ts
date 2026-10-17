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
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { WsThanosDirective } from '@wolsok/thanos';
import {
  ElemResizedDirective,
  ResizedEvent,
  ShowFpsComponent,
} from '@wolsok/ui-kit';
import { defer, Observable } from 'rxjs';
import {
  defaultIfEmpty,
  filter,
  last,
  map,
  switchMap,
  take,
  tap,
} from 'rxjs/operators';
import { BoostPadComponent } from './boost-pad/boost-pad.component';
import {
  exitFullscreen,
  fitInside,
  hasUserActivation,
  isFullscreen,
  isFullscreenSupported,
  lockLandscape,
  requestFullscreen,
  Size,
  unlockOrientation,
} from './fullscreen';
import { JoystickComponent } from './joystick/joystick.component';
import { MatchSetupComponent } from './match-setup/match-setup.component';
import { Nutrient } from './state/bacteria-simulation';
import { BotDifficulty, DEFAULT_DIFFICULTY } from './state/bot-controller';
import { arenaPointFromClient, nearestFreeCrosshair } from './touch-controls';
import {
  boostLabel,
  ColonyStats,
  humanForBoostKey,
  toColonyStats,
} from './colony-stats';
import { GameBalance, gameBalance } from './state/game-balance';
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
import { Bacteria, Player } from './state/player.model';
import { PlayerQuery } from './state/player.query';
import { PlayerService } from './state/player.service';
import {
  MatchEndAction,
  WinnerComponent,
} from './winner-info/winner.component';

/**
 * Stamps one colony into the canvas pixel buffer. Weak bacteria fade out and
 * supercharged ones burn white, so the state of a fight is visible at a glance.
 *
 * The energy thresholds come from the balance of the running level, so a level
 * that moves them still renders the fight truthfully.
 */
export function createImageDataFromBacterias(
  data8: Uint8ClampedArray,
  width: number,
  color: number[],
  bacterias: Bacteria[],
  balance: GameBalance = gameBalance
): Uint8ClampedArray {
  const [r, g, b, alpha] = color;
  const energyRange = balance.superChargedMaxEnergy - balance.maxEnergy;
  for (let i = 0; i < bacterias.length; i++) {
    const { x, y, energy } = bacterias[i];
    const data8index = (y * width + x) * 4;

    if (energy > balance.maxEnergy && energyRange > 0) {
      // Supercharged by a nutrient - burn white so the hotspots are visible.
      const heat = Math.min(1, (energy - balance.maxEnergy) / energyRange);
      data8[data8index] = r + (255 - r) * heat;
      data8[data8index + 1] = g + (255 - g) * heat;
      data8[data8index + 2] = b + (255 - b) * heat;
      data8[data8index + 3] = alpha;
      continue;
    }

    // Weakened bacteria fade out, but stay visible enough to follow the fight.
    const strength = Math.max(energy, 0) / balance.maxEnergy;
    data8[data8index] = r;
    data8[data8index + 1] = g;
    data8[data8index + 2] = b;
    data8[data8index + 3] = alpha * (0.3 + 0.7 * strength * strength);
  }

  return data8;
}

@UntilDestroy()
@Component({
  imports: [
    CommonModule,
    MatCardModule,
    WsThanosDirective,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    ShowFpsComponent,
    MatToolbarModule,
    MatIconModule,
    MatTooltipModule,
    MatchSetupComponent,
    JoystickComponent,
    BoostPadComponent,
    ElemResizedDirective,
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
  private matDialog = inject(MatDialog);

  @ViewChild('canvasElement', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('arenaStage', { static: true })
  private stageRef!: ElementRef<HTMLElement>;
  @ViewChild(WsThanosDirective, { static: true })
  private thanos!: WsThanosDirective;
  private cx!: CanvasRenderingContext2D;

  width = 320;
  height = 140;

  state: Signal<GameStateState | undefined>;
  stats: Signal<ColonyStats[]>;
  /** The colonies a finger may steer - one seat each in the touch layout. */
  protected readonly humanStats: Signal<ColonyStats[]>;
  fps$: Observable<number>;
  /** True while a match is on, paused or not. */
  protected readonly running: Signal<boolean>;
  protected readonly paused: Signal<boolean>;
  protected readonly boostLabel = boostLabel;

  /** The level the next match is played on. */
  protected readonly level: Signal<Level>;
  /** Balance of the selected level - drives both rendering and the scoreboard. */
  protected readonly balance: Signal<GameBalance>;
  /** Walls of the selected level, drawn every frame. */
  protected readonly walls: Signal<Rect[]>;
  /** The level that follows the selected one, null at the end of the list. */
  protected readonly upcomingLevel: Signal<Level | null>;
  /** Two humans or one human against the computer. */
  protected readonly mode: Signal<GameMode>;
  /** How hard the computer plays. */
  protected readonly difficulty: Signal<BotDifficulty>;
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
    return this.fullscreen() && box != null
      ? fitInside(box.width, box.height, this.width, this.height)
      : null;
  });

  /** Which crosshair each active pointer is dragging: pointerId -> playerId. */
  private readonly draggedBy = new Map<number, number>();
  /**
   * True while a native fullscreen request is waiting for the browser: the
   * pointerup and the click of one tap must not both ask.
   */
  private nativeRequestInFlight = false;

  constructor() {
    this.state = toSignal(this.query.select());
    this.fps$ = this.query.selectFps();
    this.gameStateService.reset();

    this.level = toSignal(this.query.selectLevel(), {
      initialValue: LEVELS[0],
    });
    this.balance = computed(() => levelBalance(this.level()));
    this.walls = computed(() =>
      levelMap(this.level()).createWalls(this.width, this.height)
    );
    this.upcomingLevel = computed(() => nextLevel(this.level().id));

    this.mode = toSignal(this.query.selectMode(), {
      initialValue: DEFAULT_MODE,
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

    // Repaint as soon as another level puts different walls into the arena, so
    // the start screen always shows the map the next match is fought on.
    effect(() => {
      this.walls();
      this.draw(1 / 1000, true);
    });

    this.running = toSignal(
      this.query
        .selectCurrentGameState()
        .pipe(
          map(
            (state) => state === GameState.RUNNING || state === GameState.PAUSED
          )
        ),
      { initialValue: false }
    );
    this.paused = toSignal(this.query.selectIsPaused(), {
      initialValue: false,
    });

    this.query
      .selectTimeDelta()
      .pipe(untilDestroyed(this))
      .subscribe((deltaTimeMs) => {
        const dTSec = deltaTimeMs / 1000;
        this.draw(Math.min(dTSec, 0.1));
      });

    // Triggered by the match ending rather than by a winner: a draw ends the
    // match with no winner at all and still has to show the dialog.
    this.query
      .selectMatchEnded()
      .pipe(
        filter((ended) => ended),
        switchMap(() =>
          this.matDialog
            .open<WinnerComponent, unknown, MatchEndAction | undefined>(
              WinnerComponent
            )
            .afterClosed()
        ),
        switchMap((action) => this.finishMatch(action)),
        untilDestroyed(this)
      )
      .subscribe();
  }

  /**
   * Clears the arena after a match and, when the dialog asked for it, kicks off
   * the next one right away - on the following level for "next level".
   */
  private finishMatch(action: MatchEndAction | undefined): Observable<void> {
    const next = action === 'next' ? this.upcomingLevel() : null;
    if (next != null) {
      this.gameStateService.setLevel(next.id);
    }
    return this.resetGame$().pipe(
      tap(() => {
        if (action != null) {
          this.startGame();
        }
      })
    );
  }

  ngAfterViewInit(): void {
    const { canvasEl, context } = this.getRenderingContext();
    this.cx = context;
    this.cx.imageSmoothingEnabled = false;
    canvasEl.width = this.width;
    canvasEl.height = this.height;
    this.cx.fillStyle = 'rgb(0,0,0)';
    this.cx.fillRect(0, 0, this.width, this.height);
    this.gameStateService.setArenaSize(this.width, this.height);
    this.draw(1 / 1000, true);
    this.requestNativeFullscreenOnOpen();
  }

  /** The canvas element and its 2d context, throwing when there is none. */
  private getRenderingContext() {
    const canvasEl: HTMLCanvasElement = this.canvasRef.nativeElement;

    const context = canvasEl.getContext('2d', { willReadFrequently: true });
    if (context == null) {
      throw new Error('Could not get rendering context');
    }
    return { canvasEl, context };
  }

  /** Clears the arena and starts a fresh match. */
  startGame() {
    this.cx.fillStyle = 'rgb(0,0,0)';
    this.cx.fillRect(0, 0, this.width, this.height);
    this.gameStateService.cleanup();
    this.gameStateService.init(this.width, this.height);
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
      this.gameStateService.pause();
      return this.query.selectCurrentGameState(GameState.PAUSED).pipe(
        take(1),
        switchMap(() => this.vaporize()),
        defaultIfEmpty(undefined),
        last(),
        tap(() => {
          this.gameStateService.reset();
          this.draw(1 / 1000, true);
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
    if (this.cx == null) {
      return;
    }
    const isRunning = this.query.getValue().currentState === GameState.RUNNING;

    requestAnimationFrame(() => {
      // Fade the previous frame so movement leaves a short trail.
      this.cx.fillStyle = clear ? 'rgb(0,0,0)' : 'rgba(0,0,0,0.7)';
      this.cx.fillRect(0, 0, this.width, this.height);
      this.cx.fillStyle = 'rgb(200,200,200)';
      for (const wall of this.walls()) {
        this.cx.fillRect(wall.x, wall.y, wall.width, wall.height);
      }

      if (isRunning) {
        this.playerService.gameLoop(this.width, this.height, deltaTimeInSec);
      }

      const balance = this.balance();
      const image = this.cx.getImageData(0, 0, this.width, this.height);
      const data = new Uint8ClampedArray(image.data.buffer);
      for (const colony of this.playerService.getColonies()) {
        createImageDataFromBacterias(
          data,
          this.width,
          colony.color,
          colony.bacterias,
          balance
        );
      }
      this.cx.putImageData(image, 0, 0);

      this.drawNutrients(this.playerService.getNutrients());
      this.drawPlayerCursors();
    });
  }

  /** Draws the pellets as small green crosses that dim as they are eaten. */
  private drawNutrients(nutrients: Nutrient[]): void {
    for (const nutrient of nutrients) {
      if (nutrient.amount <= 0) {
        continue;
      }
      const left = nutrient.amount / this.balance().nutrientEnergy;
      this.cx.fillStyle = `rgba(180,255,120,${0.35 + 0.65 * left})`;
      this.cx.fillRect(nutrient.x - 1, nutrient.y, 3, 1);
      this.cx.fillRect(nutrient.x, nutrient.y - 1, 1, 3);
      this.cx.fillStyle = 'rgb(255,255,255)';
      this.cx.fillRect(nutrient.x, nutrient.y, 1, 1);
    }
  }

  /**
   * Draws each player's crosshair in their own colour, with a pulsing ring
   * around it while the player's boost is running.
   */
  private drawPlayerCursors(): void {
    const boostDuration = this.balance().boostDurationSec;
    for (const player of this.playerQuery.getAll()) {
      const css = `rgba(${player.color.join(',')})`;
      this.cx.fillStyle = css;
      this.cx.fillRect(player.x - 6, player.y - 0.5, 13, 2);
      this.cx.fillRect(player.x - 0.5, player.y - 6, 2, 13);

      if (player.boostActiveSec > 0 && boostDuration > 0) {
        const left = player.boostActiveSec / boostDuration;
        this.cx.strokeStyle = css;
        this.cx.lineWidth = 1.5;
        this.cx.beginPath();
        this.cx.arc(player.x, player.y, 9 + 4 * (1 - left), 0, Math.PI * 2);
        this.cx.stroke();
      }
    }
  }

  ngOnDestroy(): void {
    this.gameStateService.cleanup();
    // Leaving the page must give the screen back as well.
    if (isFullscreen(document, this.stageRef?.nativeElement ?? undefined)) {
      exitFullscreen(document);
    }
    unlockOrientation(screen);
  }

  /** Toggles pause - the touch equivalent of the P key. */
  togglePause() {
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

  /** Puts the arena on the whole screen, or brings it back into the page. */
  protected toggleFullscreen(): void {
    if (this.fullscreen()) {
      this.leaveFullscreen();
    } else {
      this.enterFullscreen();
    }
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
   * left to the first tap or key.
   */
  private requestNativeFullscreenOnOpen(): void {
    if (hasUserActivation(navigator)) {
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
   * stands a chance: only while the layout is up, not without the API, not
   * while one is already on its way, and not while the stage is on the screen
   * already. A refusal costs nothing - the next gesture asks again.
   */
  private requestNativeFullscreen(): void {
    const stage = this.stageRef?.nativeElement;
    if (
      !this.fullscreen() ||
      this.nativeRequestInFlight ||
      !isFullscreenSupported(document, stage) ||
      isFullscreen(document, stage)
    ) {
      return;
    }
    this.nativeRequestInFlight = true;
    void requestFullscreen(stage).then(() => {
      this.nativeRequestInFlight = false;
    });
  }

  /**
   * Repeats the native fullscreen request on a user gesture, where the
   * browser grants it. Buttons are left out: their click runs first and
   * decides for itself - the button that leaves fullscreen must not have
   * the request sneak in behind it.
   */
  @HostListener('document:pointerup', ['$event'])
  protected onDocumentPointerUp(event: PointerEvent): void {
    if (!isInteractiveTarget(event.target)) {
      this.requestNativeFullscreen();
    }
  }

  @HostListener('document:click')
  protected onDocumentClick(): void {
    this.requestNativeFullscreen();
  }

  /**
   * Follows the browser: once it takes the stage off the screen - Escape, the
   * back gesture, a system dialog - the page layout returns, as the player
   * asked for exactly that. Entering the native fullscreen locks a phone into
   * landscape, where the arena and the two seats fit.
   */
  @HostListener('document:fullscreenchange')
  @HostListener('document:webkitfullscreenchange')
  protected onFullscreenChange(): void {
    if (isFullscreen(document, this.stageRef?.nativeElement ?? undefined)) {
      lockLandscape(screen);
    } else {
      unlockOrientation(screen);
      if (this.fullscreen()) {
        this.leaveFullscreen();
      }
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
    const canvas = this.canvasRef?.nativeElement as HTMLCanvasElement | null;
    if (canvas == null) {
      return null;
    }
    return arenaPointFromClient(
      event.clientX,
      event.clientY,
      canvas.getBoundingClientRect(),
      this.width,
      this.height
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
      this.toggleFullscreen();
      return;
    }
    // Escape leaves the native fullscreen through the browser; without one it
    // has to leave the component's own layout here. The key never counts as
    // a gesture, so the pending request stays with the next one.
    if ($event.key === 'Escape') {
      if (this.fullscreen()) {
        this.leaveFullscreen();
      }
      return;
    }
    // A key is a gesture too - unless it activates a focused button, which
    // decides for itself, like a click does (see onDocumentPointerUp).
    if (!isInteractiveTarget($event.target)) {
      this.requestNativeFullscreen();
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
}

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
