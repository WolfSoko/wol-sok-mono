import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { PollSort, searchPolls, sortPolls } from '../../shared/poll-search';
import {
  pendingUntilFirstValue,
  SSR_DATA_TIMEOUT_MS,
} from '../adapter/pending-until-first-value';
import { EndlessScroll } from '../core/endless-scroll/endless-scroll';
import { EndlessScrollEndComponent } from '../core/endless-scroll/endless-scroll-end.component';
import { PollListComponent } from '../core/poll-list/poll-list.component';
import { PollsRepoPort } from '../ports/polls-repo.port';
import { SITE_TAGS, SITE_URL } from './site-tags';

/** All open listed polls, searchable. */
@Component({
  selector: 'rap-polls-page',
  imports: [
    EndlessScrollEndComponent,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    PollListComponent,
    RouterLink,
  ],
  template: `
    <main class="rap-container main">
      <header>
        <h1>Browse polls</h1>
        <p class="lead">Every open public poll. Find one and add your vote.</p>
      </header>
      <div class="controls">
        <mat-form-field class="search" subscriptSizing="dynamic">
          <mat-label>Search polls</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input
            matInput
            type="search"
            autocomplete="off"
            #searchInput
            [value]="search()"
            (input)="setSearch(searchInput.value)"
            data-testid="poll-search-input"
          />
          @if (search()) {
            <button
              matIconSuffix
              mat-icon-button
              type="button"
              aria-label="Clear search"
              (click)="setSearch('')"
            >
              <mat-icon>close</mat-icon>
            </button>
          }
        </mat-form-field>
        <mat-button-toggle-group
          aria-label="Sort polls"
          [value]="sort()"
          (change)="setSort($event.value)"
          hideSingleSelectionIndicator
        >
          <mat-button-toggle value="hot" data-testid="sort-hot">
            <mat-icon>local_fire_department</mat-icon> Hot
          </mat-button-toggle>
          <mat-button-toggle value="new" data-testid="sort-new">
            <mat-icon>schedule</mat-icon> New
          </mat-button-toggle>
        </mat-button-toggle-group>
      </div>
      @if (results(); as results) {
        <p class="count" role="status" data-testid="poll-search-count">
          {{ results.length }}{{ scroll.hasMore() ? '+' : '' }}
          {{ results.length === 1 && !scroll.hasMore() ? 'poll' : 'polls' }}
          @if (search().trim()) {
            for “{{ search().trim() }}”
          }
        </p>
        @if (results.length) {
          <rap-poll-list
            [polls]="results"
            testIdPrefix="search-result-"
            data-testid="poll-search-results"
          />
        } @else if (!scroll.hasMore()) {
          <div class="empty" data-testid="poll-search-empty">
            <mat-icon class="empty-icon" aria-hidden="true"
              >search_off</mat-icon
            >
            <p>No poll matches. Why not ask it yourself?</p>
            <a mat-flat-button routerLink="/">Create a poll</a>
          </div>
        }
        <rap-endless-scroll-end [scroll]="scroll" />
      } @else if (loadFailed()) {
        <p class="error" role="alert" data-testid="poll-search-error">
          The polls could not be loaded. Please try again later.
        </p>
      } @else {
        <mat-spinner class="spinner" diameter="40" />
      }
    </main>
  `,
  styles: `
    .main {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      max-width: 760px;
      padding-block: clamp(1.5rem, 5vw, 3rem) 0;
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-display-small);
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .lead {
      margin: 0.5rem 0 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem 1rem;
    }
    .search {
      flex: 1 1 16rem;
    }
    .count {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 2rem 1rem;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);

      p {
        margin: 0;
      }
    }
    .empty-icon {
      width: 3rem;
      height: 3rem;
      font-size: 3rem;
    }
    .error {
      margin: 0;
      color: var(--mat-sys-error);
    }
    .spinner {
      align-self: center;
      margin-block: 3rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PollsPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly search = signal(
    this.route.snapshot.queryParamMap.get('q') ?? ''
  );
  protected readonly sort = signal<PollSort>(
    this.route.snapshot.queryParamMap.get('sort') === 'new' ? 'new' : 'hot'
  );

  private readonly pollsRepo = inject(PollsRepoPort);
  /** Search filters the polls loaded so far and keeps loading while few match. */
  protected readonly scroll = new EndlessScroll();
  private readonly polls = toSignal(
    toObservable(this.sort).pipe(
      // Firestore sorts, so a hot poll shows up first however old it is
      switchMap((sort) =>
        this.scroll.load(
          (count) => this.pollsRepo.watchPublicPolls(sort, count),
          (page) => page.hasMore
        )
      ),
      pendingUntilFirstValue(inject(Injector), SSR_DATA_TIMEOUT_MS),
      catchError((error: unknown) => {
        console.error('Could not load polls', error);
        return of(null);
      })
    )
  );
  protected readonly loadFailed = computed(() => this.polls() === null);

  /** `undefined` while loading. */
  protected readonly results = computed(() => {
    const page = this.polls();
    // sorted here too: live vote counts may have reordered them
    return page
      ? sortPolls(searchPolls(page.polls, this.search()), this.sort())
      : undefined;
  });

  constructor() {
    const title = inject(Title);
    const meta = inject(Meta);
    title.setTitle('Browse polls | RollaPolla');
    meta.updateTag({
      property: 'og:title',
      content: 'Browse polls | RollaPolla',
    });
    meta.updateTag({ property: 'og:url', content: `${SITE_URL}/polls` });
    inject(DestroyRef).onDestroy(() => {
      title.setTitle(SITE_TAGS.title);
      meta.updateTag({ property: 'og:title', content: SITE_TAGS.title });
      meta.updateTag({ property: 'og:url', content: SITE_TAGS.url });
    });
  }

  protected setSearch(search: string): void {
    this.search.set(search);
    this.updateUrl();
  }

  protected setSort(sort: PollSort): void {
    this.sort.set(sort);
    this.updateUrl();
  }

  /** The URL keeps search and sort, so a search can be shared or reloaded. */
  private updateUrl(): void {
    const q = this.search().trim();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: q || null,
        sort: this.sort() === 'new' ? 'new' : null,
      },
      replaceUrl: true,
    });
  }
}
