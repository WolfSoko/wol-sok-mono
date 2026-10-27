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
import { TICKS_PER_SEC } from '../state/fixed-tick';
import { getLevel, levelMap, levelSize } from '../state/levels';
import type { Replay } from '../state/replay';
import type { BacteriaLook } from '../state/skins';
import { mapZones } from '../state/zones';
import { gpuIntReplaySimulation, ReplayScene } from './replay-scene';

/** The speeds the viewer offers. */
export const REPLAY_SPEEDS = [1, 2, 4] as const;

/** How far the skip buttons jump, in seconds. */
export const REPLAY_SKIP_SECONDS = 10;

/** A time in the match as minutes and seconds, `1:05`. */
export function matchTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

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
  protected readonly time = matchTime;
  protected readonly playing = signal(true);
  protected readonly speed = signal<number>(1);
  /** The second of the match the view shows. */
  protected readonly second = signal(0);
  protected readonly over = signal(false);
  /** True while a seek plays on fast to its time. */
  protected readonly seeking = signal(false);
  /** The match's length in whole seconds. */
  protected readonly length = computed(() =>
    Math.ceil(this.replay().header.ticks / TICKS_PER_SEC)
  );
  /** True once the view runs, so that seeking has frames to play in. */
  protected readonly seekable = signal(false);

  private readonly reducedMotion = prefersReducedMotion();
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private readonly boxWidth = signal(0);
  /** The view's GL painter, whose context a GPU replay runs on. */
  private readonly glPainter = signal<GlArenaPainter | null>(null);

  /**
   * The match played back - null for a replay that does not play here. A
   * `gpu-int` replay on a trusted GPU waits for the view's GL painter: it
   * starts on the CPU and moves over before its first tick.
   */
  private readonly played = computed(() => {
    const replay = this.replay();
    const { simulation, width, height } = replay.header;
    const trusted = simulation === 'gpu-int' ? this.gpu() : null;
    const painter = trusted === null ? null : this.glPainter();
    return ReplayScene.of(
      replay,
      { look: this.look(), reducedMotion: untracked(this.reducedMotion) },
      painter === null || painter.renderer() !== trusted
        ? undefined
        : gpuIntReplaySimulation(painter, width, height)
    );
  });
  /** What the view plays: the match, telling on how far it got. */
  protected readonly scene = computed((): ArenaScene | null => {
    const played = this.played();
    return played === null
      ? null
      : {
          content: (alpha) => played.content(alpha),
          advance: (ticks) => {
            if (!played.over || played.seeking) {
              played.advance(ticks);
              this.tell(played);
            }
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
    // A scene goes with its replay. The same replay on another simulation
    // - the GPU came or went - goes on where it was, as it was.
    let shown: { replay: Replay; tick: number } | null = null;
    effect((onCleanup) => {
      const played = this.played();
      untracked(() => {
        if (played !== null && played.replay === shown?.replay) {
          if (shown.tick > 0) {
            played.seek(shown.tick);
            this.seeking.set(true);
          }
        } else {
          this.second.set(0);
          this.over.set(false);
          this.seeking.set(false);
          this.playing.set(true);
        }
      });
      onCleanup(() => {
        shown =
          played === null ? null : { replay: played.replay, tick: played.tick };
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

  /** To that second of the match, playing or paused as it was. */
  protected seekTo(second: number): void {
    const played = this.played();
    if (played === null) {
      return;
    }
    played.seek(second * TICKS_PER_SEC);
    this.second.set(Math.min(second, this.length()));
    this.seeking.set(true);
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
   * one going is let go of right away, before the context is.
   */
  protected painterChanged(painter: ArenaPainter | null): void {
    this.seekable.set(painter !== null);
    const played = untracked(this.played);
    if (painter === null && played?.onGpu === true) {
      played.dispose();
    }
    this.glPainter.set(painter instanceof GlArenaPainter ? painter : null);
  }

  /**
   * Tells what the scene got to. The view plays it outside change
   * detection, so the time is told in whole seconds, the end once.
   */
  private tell(scene: ReplayScene): void {
    if (!scene.seeking) {
      // The end reads as the length, which counts a last part second.
      const second = scene.over
        ? untracked(this.length)
        : Math.floor(scene.tick / TICKS_PER_SEC);
      if (second !== untracked(this.second)) {
        this.second.set(second);
      }
    }
    if (scene.seeking !== untracked(this.seeking)) {
      this.seeking.set(scene.seeking);
    }
    if (scene.over !== untracked(this.over)) {
      this.over.set(scene.over);
    }
  }
}
