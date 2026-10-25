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
import { TranslationKey } from '../i18n/dictionaries';
import { renderGameText } from '../i18n/game-text';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { dismissSplash } from '../splash';
import { getLevel, levelNameText } from '../state/levels';
import { GAME_SITE_URL } from '../support/legal-links';
import { PublicReplayError, PublicReplays } from './public-replays';
import { ReplayViewerComponent } from './replay-viewer.component';
import { GALLERY_PATH, WATCH_PARAM } from './watch-links';

const ERRORS: Readonly<Record<PublicReplayError, TranslationKey>> = {
  'not-found': 'replay.watchPage.notFound',
  removed: 'replay.watchPage.removed',
  unreadable: 'replay.watchPage.unreadable',
  older: 'replay.watchPage.older',
  offline: 'replay.watchPage.offline',
};

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
      @switch (state()) {
        @case ('loading') {
          <p>{{ 'replay.watchPage.loading' | t }}</p>
          <mat-progress-bar mode="indeterminate" />
        }
        @case ('error') {
          <p class="notice" role="alert">{{ errorKey() | t }}</p>
        }
        @case ('ready') {
          @if (replay(); as replay) {
            <feat-lazy-bac-game-replay-viewer
              [replay]="replay"
              [label]="'replay.watchPage.canvas' | t: { level: levelText() }"
            />
          }
        }
      }
      <nav class="links">
        @if (publicId(); as id) {
          <a mat-button [href]="siteUrl + '/' + galleryPath + '/' + id">
            {{ 'replay.watchPage.details' | t }}
          </a>
        }
        <a mat-button [href]="siteUrl + '/' + galleryPath">
          {{ 'replay.watchPage.gallery' | t }}
        </a>
        <a mat-button href="/">{{ 'replay.watchPage.game' | t }}</a>
      </nav>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: #0d1117;
      color: #e6edf3;
    }
    .page {
      max-width: 60rem;
      margin: 0 auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    h1 {
      font-size: 1.4rem;
      margin: 0.25rem 0;
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

  protected readonly siteUrl = GAME_SITE_URL;
  protected readonly galleryPath = GALLERY_PATH;

  /** The public replay's id, from the route. */
  protected readonly publicId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => params.get(WATCH_PARAM))
    ),
    { initialValue: null }
  );
  private readonly loaded = resource({
    params: () => this.publicId() ?? undefined,
    loader: ({ params }) => this.loader.load(params),
  });
  protected readonly replay = computed(() => {
    const result = this.loaded.value();
    return result !== undefined && 'replay' in result ? result.replay : null;
  });
  protected readonly state = computed(() => {
    if (this.publicId() === null) {
      return 'error';
    }
    const result = this.loaded.value();
    if (result === undefined) {
      return this.loaded.error() === undefined ? 'loading' : 'error';
    }
    return 'replay' in result ? 'ready' : 'error';
  });
  protected readonly errorKey = computed((): TranslationKey => {
    const result = this.loaded.value();
    return result !== undefined && 'error' in result
      ? ERRORS[result.error]
      : 'replay.watchPage.notFound';
  });
  /** The level's name in the active language - empty until it is loaded. */
  protected readonly levelText = computed(() => {
    const replay = this.replay();
    return replay === null
      ? ''
      : renderGameText(
          levelNameText(getLevel(replay.header.levelId)),
          (key, params) => this.i18n.t(key, params)
        );
  });

  public constructor() {
    dismissSplash(this.document);
    this.setUpHead();
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
      const id = this.publicId();
      title.setTitle(
        this.i18n.t('replay.watchPage.title', { level: this.levelText() })
      );
      meta.updateTag({
        name: 'description',
        content: this.i18n.t('replay.watchPage.description'),
      });
      canonical.href =
        id === null
          ? `${GAME_SITE_URL}/${GALLERY_PATH}`
          : `${GAME_SITE_URL}/${GALLERY_PATH}/${id}`;
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
