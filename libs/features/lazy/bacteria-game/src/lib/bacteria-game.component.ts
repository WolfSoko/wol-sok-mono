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
import {
  FullscreenOverlayContainer,
  OverlayContainer,
} from '@angular/cdk/overlay';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { WsThanosDirective } from '@wolsok/thanos';
import { ShowFpsComponent } from '@wolsok/ui-kit';
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
import {
  exitFullscreen,
  fitInside,
  isFullscreen,
  isFullscreenSupported,
  Size,
  toggleFullscreen as requestToggleFullscreen,
} from './fullscreen';
import { Nutrient } from './state/bacteria-simulation';
import { arenaPointFromClient, nearestFreeCrosshair } from './touch-controls';
import { GameBalance, gameBalance } from './state/game-balance';
import { GameStateQuery } from './state/game-state.query';
import { GameStateService } from './state/game-state.service';
import { GameState, GameStateState } from './state/game.states';
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

/** Statistics of one colony, ready to be rendered by the template. */
export interface ColonyStats {
  id: number;
  css: string;
  bacterias: number;
  captured: number;
  lost: number;
  /** Average energy in percent of the normal maximum. */
  energy: number;
  /** Share of all living bacteria in percent. */
  share: number;
}

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
    MatFormFieldModule,
    MatSelectModule,
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
  private overlayContainer = inject(OverlayContainer);

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
  fps$: Observable<number>;
  isRunning$: Observable<boolean>;
  isPaused$: Observable<boolean>;

  /** All levels, in the order they are meant to be played. */
  protected readonly levels = LEVELS;
  /** The level the next match is played on. */
  protected readonly level: Signal<Level>;
  /** Balance of the selected level - drives both rendering and the scoreboard. */
  protected readonly balance: Signal<GameBalance>;
  /** Walls of the selected level, drawn every frame. */
  protected readonly walls: Signal<Rect[]>;
  /** The level that follows the selected one, null at the end of the list. */
  protected readonly upcomingLevel: Signal<Level | null>;

  /** True while the arena fills the screen. */
  protected readonly fullscreen = signal(false);
  /** False when the browser does not offer the fullscreen API at all. */
  protected readonly fullscreenSupported = signal(true);
  /**
   * Explicit canvas size while fullscreen, null while the normal layout sizes
   * it by CSS.
   */
  protected readonly canvasSize = signal<Size | null>(null);

  /** Which crosshair each active pointer is dragging: pointerId -> playerId. */
  private readonly draggedBy = new Map<number, number>();

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

    const players = toSignal(this.playerQuery.selectAll(), {
      initialValue: [] as Player[],
    });
    this.stats = computed(() => toColonyStats(players(), this.balance()));

    // Repaint as soon as another level puts different walls into the arena, so
    // the start screen always shows the map the next match is fought on.
    effect(() => {
      this.walls();
      this.draw(1 / 1000, true);
    });

    this.isRunning$ = this.query
      .selectCurrentGameState()
      .pipe(
        map(
          (state) => state === GameState.RUNNING || state === GameState.PAUSED
        )
      );
    this.isPaused$ = this.query.selectIsPaused();

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
            .open<
              WinnerComponent,
              unknown,
              MatchEndAction | undefined
            >(WinnerComponent)
            .afterClosed()
        ),
        switchMap((action) => this.finishMatch(action)),
        untilDestroyed(this)
      )
      .subscribe();
  }

  /**
   * Leaves fullscreen before the winner dialog opens, unless the application
   * moves the overlay container into the fullscreen element.
   *
   * The browser only paints the element that fills the screen and its
   * children. A dialog rendered into the CDK overlay container next to it on
   * the body would be invisible - and it traps the focus, so the match could
   * not be left at all. An application that provides `FullscreenOverlayContainer`
   * has no such problem and keeps the dialog inside the arena.
   */
  private leaveFullscreenForDialog(): void {
    if (
      !this.fullscreen() ||
      this.overlayContainer instanceof FullscreenOverlayContainer
    ) {
      return;
    }
    exitFullscreen(document);
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
    this.fullscreenSupported.set(
      isFullscreenSupported(document, this.stageRef?.nativeElement)
    );
    this.gameStateService.setArenaSize(this.width, this.height);
    this.draw(1 / 1000, true);
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

  /** Draws each player's crosshair in their own colour. */
  private drawPlayerCursors(): void {
    for (const player of this.playerQuery.getAll()) {
      this.cx.fillStyle = `rgba(${player.color.join(',')})`;
      this.cx.fillRect(player.x - 6, player.y - 0.5, 13, 2);
      this.cx.fillRect(player.x - 0.5, player.y - 6, 2, 13);
    }
  }

  ngOnDestroy(): void {
    this.gameStateService.cleanup();
  }

  /** Toggles pause - the touch equivalent of the P key. */
  togglePause() {
    this.gameStateService.togglePause();
  }

  /** Picks the level the next match is played on. */
  protected selectLevel(levelId: string): void {
    this.gameStateService.setLevel(levelId);
  }

  /** Puts the arena on the whole screen, or brings it back into the page. */
  protected toggleFullscreen(): void {
    requestToggleFullscreen(document, this.stageRef?.nativeElement);
  }

  /**
   * Keeps the fullscreen flag in sync - also when the user leaves fullscreen
   * with Escape, which never goes through {@link toggleFullscreen}.
   */
  @HostListener('document:fullscreenchange')
  @HostListener('document:webkitfullscreenchange')
  protected onFullscreenChange(): void {
    this.fullscreen.set(
      isFullscreen(document, this.stageRef?.nativeElement ?? undefined)
    );
    this.updateCanvasSize();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.updateCanvasSize();
  }

  /**
   * Sizes the canvas element itself to the largest box with the arena's aspect
   * ratio that fits the screen.
   *
   * Letting CSS scale the drawing inside a bigger element would work visually,
   * but the pointer maths maps a touch through the bounding rect of the canvas
   * - padding hidden in that rect would offset every crosshair drag.
   */
  private updateCanvasSize(): void {
    const stage = this.stageRef?.nativeElement;
    if (!this.fullscreen() || stage == null) {
      this.canvasSize.set(null);
      return;
    }
    this.canvasSize.set(
      fitInside(stage.clientWidth, stage.clientHeight, this.width, this.height)
    );
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
      this.playerQuery.getAll(),
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
    // F is handled here rather than in the store: the fullscreen request has
    // to happen inside the key event, browsers reject it otherwise.
    if (
      $event.key.toLowerCase() === 'f' &&
      !$event.repeat &&
      !isTypingTarget($event.target)
    ) {
      this.toggleFullscreen();
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

/** Turns the stored players into the numbers the scoreboard renders. */
function toColonyStats(
  players: Player[],
  balance: GameBalance = gameBalance
): ColonyStats[] {
  const total = players.reduce((sum, player) => sum + player.bacteriaCount, 0);
  return players.map((player) => ({
    id: player.id,
    css: `rgba(${player.color.join(',')})`,
    bacterias: player.bacteriaCount,
    captured: player.captured,
    lost: player.lost,
    energy: Math.round((player.averageEnergy / balance.maxEnergy) * 100),
    share: total > 0 ? (player.bacteriaCount / total) * 100 : 0,
  }));
}
