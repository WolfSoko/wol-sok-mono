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
import { MatSliderModule } from '@angular/material/slider';
import type { ArenaPainter } from '../arena/arena-painter';
import { arenaTheme } from '../arena/arena-theme';
import {
  ArenaLayout,
  ArenaScene,
  ArenaViewComponent,
} from '../arena/arena-view.component';
import { GlArenaPainter } from '../arena/gl/gl-arena-painter';
import { TranslatePipe } from '../i18n/translate.pipe';
import { prefersReducedMotion } from '../reduced-motion';
import {
  DEFAULT_SCREEN_RESOLUTION,
  detailScale,
  renderScale,
  simResolutionOf,
  simScale,
} from '../state/arena-size';
import { clock, TICKS_PER_SEC } from '../state/fixed-tick';
import { getLevel, levelMap, levelSize } from '../state/levels';
import type { Replay } from '../state/replay';
import type { BacteriaLook } from '../state/skins';
import { mapZones } from '../state/zones';
import { ReplayScene, type ReplayLook } from './replay-scene';

/** The speeds the viewer offers. */
export const REPLAY_SPEEDS = [1, 2, 4] as const;

/** How far the skip buttons jump, in seconds. */
export const REPLAY_SKIP_SECONDS = 10;

/**
 * A recorded match played back (ADR 0011) on an `ArenaView` that plays by
 * itself: play and pause, 1x / 2x / 4x, start over, and a timeline to seek
 * on, with 10 s back and forward. Seeking plays on fast to the time asked
 * for - back from the start, as a deterministic war only plays forwards.
 * Where the host says the GPU is trusted (`gpu`), a `gpu-int` replay plays
 * on the view's GL context, as fast as the match itself was; else on
 * `IntSimulation`, the CPU twin. The game shows it for "My matches" and the
 * match just played; `/watch` for a public replay. It needs no game state,
 * account or Firebase.
 */
@Component({
  selector: 'feat-lazy-bac-game-replay-viewer',
  imports: [
    ArenaViewComponent,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSliderModule,
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
          [paused]="!playing() && !seeking()"
          [speed]="speed()"
          (painterChange)="painterChanged($event)"
        />
      </div>
      <div class="timeline">
        <span class="time">{{ time(second()) }}</span>
        <mat-slider
          class="seek"
          [min]="0"
          [max]="length()"
          [step]="1"
          [disabled]="!seekable()"
        >
          <input
            #thumb
            matSliderThumb
            data-testid="seek"
            [value]="second()"
            (change)="seekTo(thumb.valueAsNumber)"
            [attr.aria-label]="'replay.viewer.seek' | t"
            [attr.aria-valuetext]="time(second())"
          />
        </mat-slider>
        <span class="time">{{ time(length()) }}</span>
      </div>
      <div class="controls">
        <button
          mat-icon-button
          type="button"
          data-testid="back"
          [disabled]="!seekable()"
          [attr.aria-label]="'replay.viewer.back' | t: { seconds: skip }"
          (click)="skipBy(-skip)"
        >
          <mat-icon>replay_10</mat-icon>
        </button>
        <button
          mat-flat-button
          type="button"
          data-testid="play-pause"
          (click)="togglePlay()"
        >
          <mat-icon>{{ playing() ? 'pause' : 'play_arrow' }}</mat-icon>
          {{ (playing() ? 'replay.viewer.pause' : 'replay.viewer.play') | t }}
        </button>
        <button
          mat-icon-button
          type="button"
          data-testid="forward"
          [disabled]="!seekable()"
          [attr.aria-label]="'replay.viewer.forward' | t: { seconds: skip }"
          (click)="skipBy(skip)"
        >
          <mat-icon>forward_10</mat-icon>
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
      @if (seeking()) {
        <p class="notice" role="status">{{ 'replay.viewer.seeking' | t }}</p>
      } @else if (over()) {
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
    .timeline {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .seek {
      flex: 1 1 auto;
      min-width: 0;
    }
    .time {
      font-variant-numeric: tabular-nums;
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
  /**
   * The renderer of the GPU that passed the game's self-test, null where
   * none did: a `gpu-int` replay plays on the view's GPU when it is that
   * one. `/watch` runs no self-test and leaves it null.
   */
  public readonly gpu = input<string | null>(null);

  protected readonly speeds = REPLAY_SPEEDS;
  protected readonly skip = REPLAY_SKIP_SECONDS;
  protected readonly time = clock;
  protected readonly playing = signal(true);
  protected readonly speed = signal<number>(1);
  /** The second of the match the view shows. */
  protected readonly second = signal(0);
  protected readonly over = signal(false);
  /** True while a seek plays on fast to its time. */
  protected readonly seeking = signal(false);
  /** The match's length in whole seconds, as "My matches" gives it. */
  protected readonly length = computed(() =>
    Math.floor(this.replay().header.ticks / TICKS_PER_SEC)
  );

  private readonly reducedMotion = prefersReducedMotion();
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private readonly boxWidth = signal(0);
  /** The view's painter, null until the view runs and once it goes. */
  private readonly painter = signal<ArenaPainter | null>(null);
  /** True once the view runs, so that seeking has frames to play in. */
  protected readonly seekable = computed(() => this.painter() !== null);
  /** The view's GL painter where its GPU is the trusted one, else null. */
  private readonly gpuPainter = computed(() => {
    const painter = this.painter();
    return painter instanceof GlArenaPainter &&
      painter.renderer() === this.gpu()
      ? painter
      : null;
  });

  /**
   * The match played back - null for a replay that does not play here. A
   * `gpu-int` replay moves onto the trusted GPU once the view's painter is
   * there (`ReplayScene.useGpu`), and back off before its context goes.
   */
  private readonly played = computed(() =>
    ReplayScene.of(
      this.replay(),
      untracked(() => this.lookOf(this.look())),
      untracked(this.gpuPainter)
    )
  );
  /** What the view plays: the match, telling on how far it got. */
  protected readonly scene = computed((): ArenaScene | null => {
    const played = this.played();
    return played === null
      ? null
      : {
          content: (alpha) => played.content(alpha),
          // Paused, the view runs only for a seek, which plays on by itself.
          advance: (ticks) => {
            played.advance(untracked(this.playing) ? ticks : 0);
            this.tell(played);
          },
        };
  });

  /** The arena laid out on the replay's own grid, as it was played. */
  protected readonly layout = computed((): ArenaLayout => {
    const { width, height, levelId } = this.replay().header;
    const size = levelSize(getLevel(levelId));
    const sim = simResolutionOf(width, size);
    return {
      width,
      height,
      scale: renderScale(sim, DEFAULT_SCREEN_RESOLUTION, size),
      detail: detailScale(sim, DEFAULT_SCREEN_RESOLUTION, size),
      unit: simScale(sim),
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
    effect((onCleanup) => {
      const played = this.played();
      untracked(() => {
        this.second.set(0);
        this.over.set(false);
        this.seeking.set(false);
        this.playing.set(true);
      });
      // On to another replay, or the viewer goes: the engine goes too.
      onCleanup(() => played?.dispose());
    });
    effect(() => {
      const played = this.played();
      const gpu = this.gpuPainter();
      untracked(() => played?.useGpu(gpu));
    });
    effect(() => {
      const played = this.played();
      const look = this.lookOf(this.look());
      if (played !== null) {
        played.look = look;
      }
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

  /** To that second of the match, playing or paused as it was. */
  protected seekTo(second: number): void {
    const played = this.played();
    if (played === null) {
      return;
    }
    played.seek(second * TICKS_PER_SEC);
    this.tell(played);
  }

  /**
   * That many seconds on, or back with a negative number - from where a
   * seek under way is going, so that taps add up.
   */
  protected skipBy(seconds: number): void {
    this.seekTo(Math.max(0, untracked(this.second) + seconds));
  }

  /**
   * The view's painter came or goes. A GPU replay lives in its context, so
   * it moves to the CPU right away, before the context goes.
   */
  protected painterChanged(painter: ArenaPainter | null): void {
    if (painter === null) {
      untracked(this.played)?.useGpu(null);
    }
    this.painter.set(painter);
  }

  private lookOf(look: BacteriaLook): ReplayLook {
    return { look, reducedMotion: untracked(this.reducedMotion) };
  }

  /**
   * Tells what the scene got to - or is seeking to. The view plays it
   * outside change detection, so the time is told in whole seconds.
   */
  private tell(scene: ReplayScene): void {
    const second = Math.floor(scene.shownTick / TICKS_PER_SEC);
    if (second !== untracked(this.second)) {
      this.second.set(second);
    }
    if (scene.seeking !== untracked(this.seeking)) {
      this.seeking.set(scene.seeking);
    }
    if (scene.over !== untracked(this.over)) {
      this.over.set(scene.over);
    }
  }
}
