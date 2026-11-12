import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  resource,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import {
  galleryUrl,
  getLevel,
  levelNameText,
  renderGameText,
  type Replay,
  TranslationKey,
  WATCH_PARAM,
} from '@wolsok/feat-shared-bacteria-engine';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { dismissSplash } from '../splash';
import { PublicReplayError, PublicReplays } from './public-replays';
import { ReplayViewerComponent } from './replay-viewer.component';
import { WatchGpu } from './watch-gpu';

const ERRORS: Readonly<Record<PublicReplayError, TranslationKey>> = {
  'not-found': 'replay.watchPage.notFound',
  removed: 'replay.watchPage.removed',
  unreadable: 'replay.watchPage.unreadable',
  older: 'replay.matches.older',
  offline: 'replay.watchPage.offline',
};

/** What the watch page shows. */
type WatchView =
  | { kind: 'loading' }
  | { kind: 'error'; key: TranslationKey }
  | { kind: 'ready'; replay: Replay };

/**
 * `/watch/{publicId}` (ADR 0011): a public replay played back in the
 * replay viewer - outside the route with `provideGameCloud`, so it loads
 * no Firebase and signs nobody in. It is `noindex` with its canonical on
 * the replay's page `/replays/{publicId}`, which `publicSite` renders. A
 * replay that is not there (404) or was taken down (410) says so.
 */
@Component({
  selector: 'feat-lazy-bac-game-watch-page',
  imports: [
    MatButtonModule,
    MatProgressBarModule,
    ReplayViewerComponent,
    TranslatePipe,
  ],
  template: `
    <main class="page">
      <h1>
        {{ 'replay.watchPage.heading' | t: { level: levelText() || '…' } }}
      </h1>
      @let shown = view();
      @switch (shown.kind) {
        @case ('loading') {
          <p>{{ 'replay.watchPage.loading' | t }}</p>
          <mat-progress-bar mode="indeterminate" />
        }
        @case ('error') {
          <p class="notice" role="alert">{{ shown.key | t }}</p>
        }
        @case ('ready') {
          <feat-lazy-bac-game-replay-viewer
            [replay]="shown.replay"
            [gpu]="trustedGpu()"
            (gpuRenderer)="sawGpu(shown.replay, $event)"
            [label]="'replay.watchPage.canvas' | t: { level: levelText() }"
          />
        }
      }
      <nav class="links">
        @if (detailsUrl(); as url) {
          <a mat-button [href]="url">
            {{ 'replay.watchPage.details' | t }}
          </a>
        }
        <a mat-button [href]="galleryLink()">
          {{ 'replay.watchPage.gallery' | t }}
        </a>
        <a mat-button href="/">{{ 'replay.watchPage.game' | t }}</a>
      </nav>
    </main>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      background: #0d1117;
      color: #e6edf3;
    }
    .page {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
    }
    h1 {
      font-size: 1.2rem;
      margin: 0;
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .notice {
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchPageComponent {
  private readonly loader = inject(PublicReplays);
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);
  private readonly watchGpu = inject(WatchGpu);
  /** The GPU a `gpu-int` replay may play on, null while none is trusted. */
  protected readonly trustedGpu = this.watchGpu.trustedRenderer;

  /** The public replay's id, from the route. */
  protected readonly publicId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => params.get(WATCH_PARAM))
    ),
    { initialValue: null }
  );
  /** The gallery, in the game's language. */
  protected readonly galleryLink = computed(() =>
    galleryUrl(this.i18n.language())
  );
  /** The replay's own page (its canonical), null without an id. */
  protected readonly detailsUrl = computed(() => {
    const id = this.publicId();
    return id === null ? null : galleryUrl(this.i18n.language(), id);
  });
  private readonly loaded = resource({
    params: () => this.publicId() ?? undefined,
    loader: ({ params }) => this.loader.load(params),
  });
  /** What the page shows: the replay loading, why it does not play, or it. */
  protected readonly view = computed((): WatchView => {
    if (this.publicId() === null) {
      return { kind: 'error', key: ERRORS['not-found'] };
    }
    const result = this.loaded.value();
    if (result === undefined) {
      return this.loaded.error() === undefined
        ? { kind: 'loading' }
        : { kind: 'error', key: ERRORS['not-found'] };
    }
    return 'replay' in result
      ? { kind: 'ready', replay: result.replay }
      : { kind: 'error', key: ERRORS[result.error] };
  });
  /** The level's name in the active language - empty until it is loaded. */
  protected readonly levelText = computed(() => {
    const view = this.view();
    return view.kind !== 'ready'
      ? ''
      : renderGameText(
          levelNameText(getLevel(view.replay.header.levelId)),
          (key, params) => this.i18n.t(key, params)
        );
  });

  public constructor() {
    dismissSplash(this.document);
    this.setUpHead();
  }

  /**
   * The view's GPU is there. A `gpu-int` replay - every ranked match the
   * gallery features - plays on the CPU's `intSimulation` many times slower
   * than on a trusted GPU (#3059), so the page finds out whether this one
   * is; a `cpu` replay never asks.
   */
  protected sawGpu(replay: Replay, renderer: string): void {
    if (replay.header.simulation === 'gpu-int') {
      this.watchGpu.start(renderer);
    }
  }

  /**
   * The title and description, `noindex`, and the canonical on the
   * replay's own page - put back as they were on leaving.
   */
  private setUpHead(): void {
    const title = inject(Title);
    const meta = inject(Meta);
    const previousTitle = title.getTitle();
    const previousDescription = meta.getTag('name="description"')?.content;
    const canonical = this.document.createElement('link');
    canonical.rel = 'canonical';
    this.document.head.append(canonical);
    meta.updateTag({ name: 'robots', content: 'noindex' });
    effect(() => {
      title.setTitle(
        this.i18n.t('replay.watchPage.title', { level: this.levelText() })
      );
      meta.updateTag({
        name: 'description',
        content: this.i18n.t('replay.watchPage.description'),
      });
      canonical.href = this.detailsUrl() ?? this.galleryLink();
    });
    inject(DestroyRef).onDestroy(() => {
      title.setTitle(previousTitle);
      if (previousDescription !== undefined) {
        meta.updateTag({ name: 'description', content: previousDescription });
      }
      meta.removeTag('name="robots"');
      canonical.remove();
    });
  }
}
