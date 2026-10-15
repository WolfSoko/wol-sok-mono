import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { pollClosesAt } from '../../shared/poll';
import { PollsRepoPort } from '../ports/polls-repo.port';
import { catchError, of } from 'rxjs';
import { SITE_TAGS } from './site-tags';

const LOAD_FAILED = 'load-failed' as const;

@Component({
  selector: 'rap-my-polls-page',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  template: `
    <main class="rap-container main">
      <header>
        <h1>My polls</h1>
        <p class="lead">
          Polls you created here. Sign in with Google to see them on all your
          devices.
        </p>
      </header>
      @if (polls(); as polls) {
        @if (polls.length) {
          <ul class="polls" data-testid="my-polls-list">
            @for (poll of polls; track poll.id) {
              <li>
                <a
                  class="poll"
                  [routerLink]="['/poll', poll.id]"
                  [attr.data-testid]="'my-poll-' + poll.id"
                >
                  <span class="question">{{ poll.question }}</span>
                  <span class="meta">
                    {{ poll.totalVotes }}
                    {{ poll.totalVotes === 1 ? 'vote' : 'votes' }} ·
                    {{ poll.createdAt | date: 'mediumDate' }} ·
                    @if (poll.closesAt > now) {
                      <span class="open">open until</span>
                      {{ poll.closesAt | date: 'mediumDate' }}
                    } @else {
                      <span class="closed">closed</span>
                    }
                  </span>
                </a>
              </li>
            }
          </ul>
        } @else {
          <mat-card
            appearance="outlined"
            class="empty"
            data-testid="my-polls-empty"
          >
            <mat-icon class="empty-icon" aria-hidden="true">ballot</mat-icon>
            <mat-card-header>
              <mat-card-title>No polls yet</mat-card-title>
              <mat-card-subtitle>
                Create a poll and it shows up here.
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-actions>
              <a mat-flat-button routerLink="/">Create a poll</a>
            </mat-card-actions>
          </mat-card>
        }
      } @else if (loadFailed()) {
        <p class="error" role="alert" data-testid="my-polls-error">
          Your polls could not be loaded. Please try again later.
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
      gap: 1rem;
      max-width: 760px;
      padding-block: clamp(1.5rem, 5vw, 3rem) 0;
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-medium);
    }
    .lead {
      margin: 0.25rem 0 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .error {
      margin: 0;
      color: var(--mat-sys-error);
    }
    .spinner {
      align-self: center;
      margin-block: 3rem;
    }
    .polls {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .poll {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 1rem 1.25rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--rap-radius-md);
      background: var(--rap-card-surface);
      color: inherit;
      text-decoration: none;
    }
    .poll:hover,
    .poll:focus-visible {
      border-color: var(--mat-sys-primary);
    }
    .question {
      font: var(--mat-sys-title-medium);
      overflow-wrap: anywhere;
    }
    .meta {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .open {
      color: var(--mat-sys-primary);
    }
    .empty {
      align-items: center;
      gap: 0.5rem;
      padding: 2.5rem 1rem 1.5rem;
      text-align: center;
    }
    .empty-icon {
      width: 3rem;
      height: 3rem;
      font-size: 3rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class MyPollsPageComponent {
  protected readonly now = new Date();

  private readonly myPolls = toSignal(
    inject(PollsRepoPort)
      .watchMyPolls()
      .pipe(
        // e.g. a missing index right after a deploy; toSignal would rethrow
        catchError((error: unknown) => {
          console.error('Could not load my polls', error);
          return of(LOAD_FAILED);
        })
      )
  );

  protected readonly loadFailed = computed(
    () => this.myPolls() === LOAD_FAILED
  );

  /** `undefined` while loading; an empty list when signed out. */
  protected readonly polls = computed(() => {
    const polls = this.myPolls();
    if (polls === undefined || polls === LOAD_FAILED) {
      return undefined;
    }
    return (polls ?? []).map((poll) => ({
      ...poll,
      closesAt: pollClosesAt(poll),
    }));
  });

  constructor() {
    const title = inject(Title);
    const meta = inject(Meta);
    title.setTitle('My polls | RollaPolla');
    // personal page, nothing for search engines
    meta.updateTag({ name: 'robots', content: 'noindex' });
    inject(DestroyRef).onDestroy(() => {
      title.setTitle(SITE_TAGS.title);
      meta.updateTag({ name: 'robots', content: SITE_TAGS.robots });
    });
  }
}
