import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { arenaTheme } from '../arena/arena-theme';
import {
  ArenaLayout,
  ArenaScene,
  ArenaViewComponent,
} from '../arena/arena-view.component';
import { TranslatePipe } from '../i18n/translate.pipe';
import { prefersReducedMotion } from '../reduced-motion';
import {
  DEFAULT_SCREEN_RESOLUTION,
  detailScale,
  ONLINE_SIM_RESOLUTION,
  renderScale,
  simScale,
} from '../state/arena-size';
import { getLevel, levelMap, levelSize } from '../state/levels';
import type { Replay } from '../state/replay';
import type { BacteriaLook } from '../state/skins';
import { mapZones } from '../state/zones';
import { ReplayScene } from './replay-scene';

/** The speeds the viewer offers. */
export const REPLAY_SPEEDS = [1, 2, 4] as const;

/**
 * A recorded match played back (ADR 0011) on an `ArenaView` that plays by
 * itself: play and pause, 1x / 2x / 4x and start over, with how far it
 * got. Seeking needs checkpoints and comes later. The game shows it for
 * "My matches" and the match just played; `/watch` for a public replay.
 * It needs no game state, account or Firebase.
 */
@Component({
  selector: 'feat-lazy-bac-game-replay-viewer',
  imports: [
    ArenaViewComponent,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressBarModule,
    TranslatePipe,
  ],
  template: `
    @if (scene(); as scene) {
      <div class="arena" #box [attr.aria-label]="label()" role="img">
        <feat-lazy-bac-game-arena-view
          [layout]="layout()"
          [scene]="scene"
          [theme]="theme()"
          [zones]="zones()"
          [size]="size()"
          [autoplay]="true"
          [paused]="!playing()"
          [speed]="speed()"
        />
      </div>
      <mat-progress-bar
        mode="determinate"
        [value]="progress()"
        aria-hidden="true"
      />
      <div class="controls">
        <button
          mat-flat-button
          type="button"
          data-testid="play-pause"
          (click)="togglePlay()"
        >
          <mat-icon>{{ playing() ? 'pause' : 'play_arrow' }}</mat-icon>
          {{ (playing() ? 'replay.viewer.pause' : 'replay.viewer.play') | t }}
        </button>
        <mat-button-toggle-group
          hideSingleSelectionIndicator
          [value]="speed()"
          (change)="speed.set($event.value)"
          [attr.aria-label]="'replay.viewer.speed' | t: { speed: speed() }"
        >
          @for (option of speeds; track option) {
            <mat-button-toggle [value]="option"
              >{{ option }}×</mat-button-toggle
            >
          }
        </mat-button-toggle-group>
        <button mat-button type="button" (click)="startOver()">
          <mat-icon>replay</mat-icon>
          {{ 'replay.viewer.startOver' | t }}
        </button>
      </div>
      @if (over()) {
        <p class="notice" role="status">{{ 'replay.viewer.over' | t }}</p>
      }
    } @else {
      <p class="notice" role="alert">{{ 'replay.matches.older' | t }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 0;
    }
    .arena {
      display: flex;
      justify-content: center;
      width: 100%;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .notice {
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplayViewerComponent {
  /** The recorded match to play back. */
  public readonly replay = input.required<Replay>();
  /** How the colonies look - the device's skin in the game. */
  public readonly look = input<BacteriaLook>('slime');
  /** What a screen reader says of the arena. */
  public readonly label = input('');

  protected readonly speeds = REPLAY_SPEEDS;
  protected readonly playing = signal(true);
  protected readonly speed = signal<number>(1);
  /** How far the match got, 0 to 100. */
  protected readonly progress = signal(0);
  protected readonly over = signal(false);

  private readonly reducedMotion = prefersReducedMotion();
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private readonly boxWidth = signal(0);

  /** The match played back - null for a replay that does not play here. */
  private readonly played = computed(() =>
    ReplayScene.of(this.replay(), {
      look: this.look(),
      reducedMotion: untracked(this.reducedMotion),
    })
  );
  /**
   * What the view plays: the match, telling on how far it got. The view
   * plays it outside change detection, so the progress is told in whole
   * percent, and the end once.
   */
  protected readonly scene = computed((): ArenaScene | null => {
    const played = this.played();
    return played === null
      ? null
      : {
          content: (alpha) => played.content(alpha),
          advance: (ticks) => {
            if (!played.over) {
              played.advance(ticks);
              this.tell(played);
            }
          },
        };
  });

  protected readonly layout = computed((): ArenaLayout => {
    const { width, height, levelId } = this.replay().header;
    const size = levelSize(getLevel(levelId));
    return {
      width,
      height,
      scale: renderScale(
        ONLINE_SIM_RESOLUTION,
        DEFAULT_SCREEN_RESOLUTION,
        size
      ),
      detail: detailScale(
        ONLINE_SIM_RESOLUTION,
        DEFAULT_SCREEN_RESOLUTION,
        size
      ),
      unit: simScale(ONLINE_SIM_RESOLUTION),
    };
  });
  protected readonly theme = computed(() =>
    arenaTheme(this.replay().header.levelId)
  );
  protected readonly zones = computed(() => {
    const { levelId, width, height } = this.replay().header;
    return mapZones(levelMap(getLevel(levelId)), width, height);
  });
  /** The canvas fitted into the width it has, at the arena's aspect. */
  protected readonly size = computed(() => {
    const { width, height, scale } = this.layout();
    const fitted = Math.min(this.boxWidth() || width * scale, width * scale);
    return { width: fitted, height: (fitted * height) / width };
  });

  public constructor() {
    // A scene goes with its replay.
    effect((onCleanup) => {
      const played = this.played();
      untracked(() => {
        this.progress.set(0);
        this.over.set(false);
        this.playing.set(true);
      });
      // On to another replay, or the viewer goes: the engine goes too.
      onCleanup(() => played?.dispose());
    });
    effect((onCleanup) => {
      const box = this.box()?.nativeElement;
      if (box === undefined || typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(([entry]) =>
        this.boxWidth.set(entry.contentRect.width)
      );
      observer.observe(box);
      onCleanup(() => observer.disconnect());
    });
  }

  protected togglePlay(): void {
    if (this.over()) {
      this.startOver();
      return;
    }
    this.playing.update((playing) => !playing);
  }

  protected startOver(): void {
    const played = this.played();
    if (played !== null) {
      played.restart();
      this.tell(played);
    }
    this.playing.set(true);
  }

  private tell(scene: ReplayScene): void {
    const percent = Math.floor(
      (100 * scene.tick) / Math.max(1, scene.replay.header.ticks)
    );
    if (percent !== untracked(this.progress)) {
      this.progress.set(percent);
    }
    if (scene.over !== untracked(this.over)) {
      this.over.set(scene.over);
    }
  }
}
