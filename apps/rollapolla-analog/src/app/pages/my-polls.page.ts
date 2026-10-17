import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { EndlessScroll } from '../core/endless-scroll/endless-scroll';
import { EndlessScrollEndComponent } from '../core/endless-scroll/endless-scroll-end.component';
import { PollsRepoPort } from '../ports/polls-repo.port';
import { retry, tap, timer } from 'rxjs';
import { useNoindexPage } from './site-tags';

/** How long to wait before listening again after loading failed. */
const RETRY_DELAY_MS = 10_000;

@Component({
  selector: 'rap-my-polls-page',
  imports: [
    DatePipe,
    EndlessScrollEndComponent,
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
      @if (loadFailed()) {
        <p class="error" role="alert" data-testid="my-polls-error">
          Your polls could not be loaded. Trying again…
        </p>
      } @else if (polls(); as polls) {
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
                    @if (!poll.listed) {
                      ·
                      <span class="private" data-testid="private-poll-marker">
                        <mat-icon class="rap-icon-sm" aria-hidden="true"
                          >lock</mat-icon
                        >
                        private
                      </span>
                    }
                  </span>
                </a>
              </li>
            }
          </ul>
          <rap-endless-scroll-end [scroll]="scroll" />
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
    .private {
      display: inline-flex;
      align-items: center;
      gap: 0.125rem;
      vertical-align: bottom;
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

  /** Stays set until polls (or the signed-out state) load again. */
  protected readonly loadFailed = signal(false);

  protected readonly scroll = new EndlessScroll();
  private readonly pollsRepo = inject(PollsRepoPort);
  private readonly myPolls = toSignal(
    this.pollsRepo.watchMyPolls(this.scroll.counts).pipe(
      tap((page) => {
        if (page !== undefined) {
          this.loadFailed.set(false);
          this.scroll.answered(!!page?.hasMore);
        }
      }),
      // e.g. the index still building right after a deploy. Listening again
      // also picks up a sign-in or account switch made in the meantime.
      retry({
        delay: (error: unknown) => {
          console.error('Could not load my polls', error);
          this.loadFailed.set(true);
          return timer(RETRY_DELAY_MS);
        },
      })
    )
  );

  /** `undefined` while loading; an empty list when signed out. */
  protected readonly polls = computed(() => {
    const page = this.myPolls();
    if (page === undefined) {
      return undefined;
    }
    return page?.polls ?? [];
  });

  constructor() {
    useNoindexPage('My polls | RollaPolla');
  }
}
