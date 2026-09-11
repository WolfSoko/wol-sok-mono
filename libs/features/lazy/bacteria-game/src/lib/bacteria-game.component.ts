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
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { WsThanosDirective } from '@wolsok/thanos';
import { ShowFpsComponent } from '@wolsok/ui-kit';
import { Observable } from 'rxjs';
import { filter, map, switchMap, take } from 'rxjs/operators';
import { Nutrient } from './state/bacteria-simulation';
import { createWalls, gameBalance } from './state/game-balance';
import { GameStateQuery } from './state/game-state.query';
import { GameStateService } from './state/game-state.service';
import { GameState, GameStateState } from './state/game.states';
import { Bacteria, Player } from './state/player.model';
import { PlayerQuery } from './state/player.query';
import { PlayerService } from './state/player.service';
import { WinnerComponent } from './winner-info/winner.component';

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

const ENERGY_RANGE = gameBalance.superChargedMaxEnergy - gameBalance.maxEnergy;

/**
 * Stamps one colony into the canvas pixel buffer. Weak bacteria fade out and
 * supercharged ones burn white, so the state of a fight is visible at a glance.
 */
export function createImageDataFromBacterias(
  data8: Uint8ClampedArray,
  width: number,
  color: number[],
  bacterias: Bacteria[]
): Uint8ClampedArray {
  const [r, g, b, alpha] = color;
  for (let i = 0; i < bacterias.length; i++) {
    const { x, y, energy } = bacterias[i];
    const data8index = (y * width + x) * 4;

    if (energy > gameBalance.maxEnergy && ENERGY_RANGE > 0) {
      // Supercharged by a nutrient - burn white so the hotspots are visible.
      const heat = Math.min(1, (energy - gameBalance.maxEnergy) / ENERGY_RANGE);
      data8[data8index] = r + (255 - r) * heat;
      data8[data8index + 1] = g + (255 - g) * heat;
      data8[data8index + 2] = b + (255 - b) * heat;
      data8[data8index + 3] = alpha;
      continue;
    }

    // Weakened bacteria fade out, but stay visible enough to follow the fight.
    const strength = Math.max(energy, 0) / gameBalance.maxEnergy;
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
  private canvasRef!: ElementRef;
  @ViewChild(WsThanosDirective, { static: true })
  private thanos!: WsThanosDirective;
  private cx!: CanvasRenderingContext2D;
  private walls = createWalls(320, 140);

  width = 320;
  height = 140;

  state: Signal<GameStateState | undefined>;
  stats: Signal<ColonyStats[]>;
  fps$: Observable<number>;
  isRunning$: Observable<boolean>;

  constructor() {
    this.state = toSignal(this.query.select());
    this.fps$ = this.query.selectFps();
    this.gameStateService.reset();

    const players = toSignal(this.playerQuery.selectAll(), {
      initialValue: [] as Player[],
    });
    this.stats = computed(() => toColonyStats(players()));

    this.isRunning$ = this.query
      .selectCurrentGameState()
      .pipe(
        map(
          (state) => state === GameState.RUNNING || state === GameState.PAUSED
        )
      );

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
        switchMap(() => this.matDialog.open(WinnerComponent).afterClosed()),
        untilDestroyed(this)
      )
      .subscribe(() => this.resetGame());
  }

  ngAfterViewInit(): void {
    const { canvasEl, context } = this.getRenderingContext();
    this.cx = context;
    this.cx.imageSmoothingEnabled = false;
    canvasEl.width = this.width;
    canvasEl.height = this.height;
    this.walls = createWalls(this.width, this.height);
    this.cx.fillStyle = 'rgb(0,0,0)';
    this.cx.fillRect(0, 0, this.width, this.height);
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
    this.query
      .selectCurrentGameState(GameState.PAUSED)
      .pipe(
        take(1),
        switchMap(() => this.vaporize())
      )
      .subscribe({
        complete: () => {
          this.gameStateService.reset();
          this.draw(1 / 1000);
        },
      });
    this.gameStateService.pause();
  }

  /** Advances the simulation by one frame and renders the arena. */
  private draw(deltaTimeInSec: number) {
    if (this.cx == null) {
      return;
    }
    const isRunning = this.query.getValue().currentState === GameState.RUNNING;

    requestAnimationFrame(() => {
      // Fade the previous frame so movement leaves a short trail.
      this.cx.fillStyle = 'rgba(0,0,0,0.7)';
      this.cx.fillRect(0, 0, this.width, this.height);
      this.cx.fillStyle = 'rgb(200,200,200)';
      for (const wall of this.walls) {
        this.cx.fillRect(wall.x, wall.y, wall.width, wall.height);
      }

      if (isRunning) {
        this.playerService.gameLoop(this.width, this.height, deltaTimeInSec);
      }

      const image = this.cx.getImageData(0, 0, this.width, this.height);
      const data = new Uint8ClampedArray(image.data.buffer);
      for (const colony of this.playerService.getColonies()) {
        createImageDataFromBacterias(
          data,
          this.width,
          colony.color,
          colony.bacterias
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
      const left = nutrient.amount / gameBalance.nutrientEnergy;
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

  @HostListener('document:keydown', ['$event'])
  onKeyDown($event: KeyboardEvent) {
    this.gameStateService.addKeyPress($event.key);
  }

  @HostListener('document:keyup', ['$event'])
  onKeyUp($event: KeyboardEvent) {
    this.gameStateService.removeKeyPress($event.key);
  }
}

/** Turns the stored players into the numbers the scoreboard renders. */
function toColonyStats(players: Player[]): ColonyStats[] {
  const total = players.reduce((sum, player) => sum + player.bacteriaCount, 0);
  return players.map((player) => ({
    id: player.id,
    css: `rgba(${player.color.join(',')})`,
    bacterias: player.bacteriaCount,
    captured: player.captured,
    lost: player.lost,
    energy: Math.round((player.averageEnergy / gameBalance.maxEnergy) * 100),
    share: total > 0 ? (player.bacteriaCount / total) * 100 : 0,
  }));
}
