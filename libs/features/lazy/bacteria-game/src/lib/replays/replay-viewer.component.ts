import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import type { ArenaLayout, ArenaPainter } from '../arena/arena-painter';
import { arenaTheme } from '../arena/arena-theme';
import { ArenaScene, ArenaViewComponent } from '../arena/arena-view.component';
import { GlArenaPainter } from '../arena/gl/gl-arena-painter';
import {
  exitFullscreen,
  fitInside,
  isFullscreen,
  isFullscreenSupported,
  requestFullscreen,
} from '../fullscreen';
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

/** How long the controls stay after the last touch while the replay plays. */
export const CHROME_HIDE_MS = 3000;

/**
 * A recorded match played back (ADR 0011) like a video: the arena fills
 * the box the viewer is given, at its own aspect, and the controls lie over
 * it - play and pause, 1x / 2x / 4x, start over, a timeline to seek on with
 * 10 s back and forward, and the fullscreen where the browser has it. They
 * fade out a few seconds into playback and come back on a touch, a move of
 * the pointer or a key; a click on the arena plays and pauses, Space or K,
 * J / L and the arrows, Home and F work from the keyboard. Seeking plays on
 * fast to the time asked for - back from the start, as a deterministic war
 * only plays forwards. Where the host says the GPU is trusted (`gpu`), a
 * `gpu-int` replay plays on the view's GL context, as fast as the match
 * itself was; else on `IntSimulation`, the CPU twin. The game shows it for
 * "My matches" and the match just played; `/watch` for a public replay. It
 * needs no game state, account or Firebase.
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
  host: {
    tabindex: '0',
    '[class.chrome-hidden]': '!chromeShown()',
    '(keydown)': 'onKeyDown($event)',
    '(pointerdown)': 'onPointerDown()',
    '(focusin)': 'wake()',
    '(document:fullscreenchange)': 'onFullscreenChange()',
    '(document:webkitfullscreenchange)': 'onFullscreenChange()',
  },
  template: `
    @if (scene(); as scene) {
      <div
        class="arena"
        #box
        [attr.aria-label]="label()"
        role="img"
        (click)="onArenaClick()"
      >
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
      @if (seeking()) {
        <p class="notice" role="status">{{ 'replay.viewer.seeking' | t }}</p>
      } @else if (over()) {
        <p class="notice" role="status">{{ 'replay.viewer.over' | t }}</p>
      }
      @if (closeLabel() || title()) {
        <div
          class="chrome top"
          (pointerenter)="hovering.set(true)"
          (pointerleave)="hovering.set(false)"
          (focusin)="focused.set(true)"
          (focusout)="focused.set(false)"
        >
          @if (closeLabel(); as closeLabel) {
            <button
              mat-icon-button
              type="button"
              data-testid="close"
              [attr.aria-label]="closeLabel"
              (click)="close.emit()"
            >
              <mat-icon>arrow_back</mat-icon>
            </button>
          }
          @if (title(); as title) {
            <span class="title">{{ title }}</span>
          }
        </div>
      }
      <div
        class="chrome bottom"
        role="group"
        [attr.aria-label]="'replay.viewer.controls' | t"
        (pointerenter)="hovering.set(true)"
        (pointerleave)="hovering.set(false)"
        (focusin)="focused.set(true)"
        (focusout)="focused.set(false)"
      >
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
        <div class="buttons">
          <button
            mat-icon-button
            type="button"
            data-testid="play-pause"
            [attr.aria-label]="
              (showsPause() ? 'replay.viewer.pause' : 'replay.viewer.play') | t
            "
            (click)="togglePlay()"
          >
            <mat-icon>{{ showsPause() ? 'pause' : 'play_arrow' }}</mat-icon>
          </button>
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
            mat-icon-button
            type="button"
            data-testid="forward"
            [disabled]="!seekable()"
            [attr.aria-label]="'replay.viewer.forward' | t: { seconds: skip }"
            (click)="skipBy(skip)"
          >
            <mat-icon>forward_10</mat-icon>
          </button>
          <button
            mat-icon-button
            type="button"
            data-testid="start-over"
            [attr.aria-label]="'replay.viewer.startOver' | t"
            (click)="startOver()"
          >
            <mat-icon>replay</mat-icon>
          </button>
          <span class="time">{{ time(second()) }} / {{ time(length()) }}</span>
          <span class="spacer"></span>
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
          @if (fullscreenSupported) {
            <button
              mat-icon-button
              type="button"
              data-testid="fullscreen"
              [attr.aria-label]="
                (fullscreen() ? 'common.exitFullscreen' : 'common.fullscreen')
                  | t
              "
              (click)="toggleFullscreen()"
            >
              <mat-icon>{{
                fullscreen() ? 'fullscreen_exit' : 'fullscreen'
              }}</mat-icon>
            </button>
          }
        </div>
      </div>
    } @else {
      <p class="alert" role="alert">{{ 'replay.matches.older' | t }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      position: relative;
      flex: 1 1 auto;
      min-height: 0;
      min-width: 0;
      width: 100%;
      background: #000;
      overflow: hidden;
      outline: none;
      color: #fff;
      --mat-icon-button-icon-color: #fff;
      --mat-icon-button-disabled-icon-color: rgb(255 255 255 / 40%);
      --mat-slider-active-track-color: var(--bw-gold, #e9b949);
      --mat-slider-handle-color: var(--bw-gold, #e9b949);
      --mat-slider-focus-handle-color: var(--bw-gold, #e9b949);
      --mat-slider-hover-handle-color: var(--bw-gold, #e9b949);
      --mat-slider-inactive-track-color: rgb(255 255 255 / 40%);
      --mat-button-toggle-height: 2rem;
      --mat-button-toggle-text-color: #fff;
      --mat-button-toggle-selected-state-text-color: #fff;
      --mat-button-toggle-background-color: transparent;
      --mat-button-toggle-selected-state-background-color: rgb(
        255 255 255 / 25%
      );
      --mat-button-toggle-divider-color: rgb(255 255 255 / 30%);
    }
    :host:focus-visible {
      box-shadow: inset 0 0 0 3px var(--bw-gold, #e9b949);
    }
    :host.chrome-hidden {
      cursor: none;
    }
    .arena {
      flex: 1 1 auto;
      min-height: 0;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .chrome {
      position: absolute;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      transition: opacity 300ms;
    }
    .top {
      top: 0;
      background: linear-gradient(rgb(0 0 0 / 80%), transparent);
    }
    .bottom {
      bottom: 0;
      flex-direction: column;
      align-items: stretch;
      background: linear-gradient(transparent, rgb(0 0 0 / 80%));
    }
    :host.chrome-hidden .chrome {
      opacity: 0;
      pointer-events: none;
    }
    .title {
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .seek {
      width: 100%;
      margin: 0;
    }
    .buttons {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
    }
    .time {
      font-variant-numeric: tabular-nums;
      padding: 0 0.5rem;
      white-space: nowrap;
    }
    .spacer {
      flex: 1 1 auto;
    }
    .notice {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      margin: 0;
      padding: 0.5rem 1rem;
      border-radius: 1rem;
      background: rgb(0 0 0 / 70%);
      pointer-events: none;
    }
    .alert {
      margin: auto;
      padding: 1rem;
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
  /** A title over the arena, none without it. */
  public readonly title = input<string | null>(null);
  /** The label of a way out over the arena, which emits `close`; none without it. */
  public readonly closeLabel = input<string | null>(null);

  /** The way out over the arena was taken. */
  public readonly close = output<void>();

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
  /** The button shows "Pause" while the match plays and is not over. */
  protected readonly showsPause = computed(
    () => this.playing() && !this.over()
  );

  /** True while the pointer is over the controls. */
  protected readonly hovering = signal(false);
  /** True while the focus is within the controls. */
  protected readonly focused = signal(false);
  /** True for a while after the last touch, move or key. */
  private readonly awake = signal(false);
  /** The controls are seen: paused, seeking, over, used, or touched lately. */
  protected readonly chromeShown = computed(
    () =>
      !this.playing() ||
      this.seeking() ||
      this.over() ||
      this.hovering() ||
      this.focused() ||
      this.awake()
  );
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  /** When the controls were last woken, in `Date.now()` ms. */
  private wokeAt = 0;
  /**
   * Whether the controls were seen as the pointer went down: a tap on the
   * arena that brings them back is not a tap to pause. True without a
   * pointer, as a click sent by itself has none.
   */
  private chromeWasShown = true;

  /** True while the viewer itself fills the screen. */
  protected readonly fullscreen = signal(false);

  private readonly document = inject(DOCUMENT);
  private readonly host =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** True where the browser lets the viewer fill the screen. */
  protected readonly fullscreenSupported = isFullscreenSupported(
    this.document,
    this.host
  );
  private readonly reducedMotion = prefersReducedMotion();
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  /** The arena box's size in CSS pixels, zero until it is measured. */
  private readonly boxSize = signal({ width: 0, height: 0 });
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
      // A gpu-int replay plays on the GPU only where it is trusted - never
      // on one that renders on the CPU.
      softwareWebGl: false,
    };
  });
  protected readonly theme = computed(() =>
    arenaTheme(this.replay().header.levelId)
  );
  protected readonly zones = computed(() => {
    const { levelId, width, height } = this.replay().header;
    return mapZones(levelMap(getLevel(levelId)), width, height);
  });
  /**
   * The canvas fitted into the box it has, at the arena's aspect, as large
   * as the box lets it - its own size while the box is not measured yet.
   */
  protected readonly size = computed(() => {
    const { width, height, scale } = this.layout();
    const box = this.boxSize();
    return (
      fitInside(box.width, box.height, width, height) ?? {
        width: width * scale,
        height: height * scale,
      }
    );
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
      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        this.boxSize.set({ width, height });
      });
      observer.observe(box);
      onCleanup(() => observer.disconnect());
    });
    // Playing on, the controls stay a moment longer and then go.
    effect(() => {
      if (this.playing()) {
        untracked(() => this.wake());
      }
    });
    // Not a host listener: that would mark the view dirty on every move of
    // the pointer, while `wake` mostly returns early. Setting `awake` still
    // schedules change detection when the state flips.
    const wake = () => this.wake();
    this.host.addEventListener('pointermove', wake, { passive: true });
    inject(DestroyRef).onDestroy(() => {
      this.host.removeEventListener('pointermove', wake);
      this.clearHideTimer();
    });
  }

  protected togglePlay(): void {
    if (this.over()) {
      this.startOver();
      return;
    }
    this.playing.update((playing) => !playing);
  }

  /** A touch wakes the controls; the click that follows sees whether they were up. */
  protected onPointerDown(): void {
    this.chromeWasShown = untracked(this.chromeShown);
    this.wake();
  }

  /**
   * A click on the arena plays and pauses, like a video - unless it was the
   * tap that brought the controls back, which is all a tap does then.
   */
  protected onArenaClick(): void {
    if (this.chromeWasShown) {
      this.togglePlay();
    }
    this.chromeWasShown = true;
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

  /**
   * Shows the controls, for `CHROME_HIDE_MS` from now. A move soon after
   * the last one leaves the timer as it is: the controls then go between
   * half that and the whole of it after the last move, with no timer set
   * on every move of the pointer.
   */
  protected wake(): void {
    const now = Date.now();
    if (untracked(this.awake) && now - this.wokeAt < CHROME_HIDE_MS / 2) {
      return;
    }
    this.wokeAt = now;
    this.awake.set(true);
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.awake.set(false);
    }, CHROME_HIDE_MS);
  }

  /**
   * The player's keys, as a video player has them. Keys on the controls
   * themselves are theirs - the slider's arrows, the buttons' Space - but
   * for F, which is the player's wherever the focus is. A handled key goes
   * no further, so the stage's own F stays out of it.
   */
  protected onKeyDown(event: KeyboardEvent): void {
    const onControl =
      event.target instanceof Element &&
      event.target.closest('.chrome') !== null;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (onControl && key !== 'f') {
      return;
    }
    switch (key) {
      case ' ':
      case 'k':
        this.togglePlay();
        break;
      case 'ArrowLeft':
      case 'j':
        this.skipBy(-this.skip);
        break;
      case 'ArrowRight':
      case 'l':
        this.skipBy(this.skip);
        break;
      case 'Home':
        this.startOver();
        break;
      case 'f':
        if (!this.fullscreenSupported) {
          return;
        }
        this.toggleFullscreen();
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.wake();
  }

  protected toggleFullscreen(): void {
    if (this.fullscreen()) {
      exitFullscreen(this.document);
    } else {
      void requestFullscreen(this.host);
    }
  }

  /** The browser put the viewer on the screen, or took it off. */
  protected onFullscreenChange(): void {
    this.fullscreen.set(isFullscreen(this.document, this.host));
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
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
