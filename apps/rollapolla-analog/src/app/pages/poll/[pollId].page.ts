import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, startWith, switchMap } from 'rxjs';
import { pendingUntilFirstValue } from '../../adapter/pending-until-first-value';
import { PollVoteComponent } from '../../core/poll-vote/poll-vote.component';
import { PollsRepoPort } from '../../ports/polls-repo.port';
import { usePollMetaTags } from './poll-meta';

/** Longest the server waits for the poll before it renders the page without it. */
const SSR_POLL_TIMEOUT_MS = 1500;

@Component({
  selector: 'rap-poll-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PollVoteComponent,
    RouterLink,
  ],
  template: `
    <main class="rap-container main">
      <nav>
        <a mat-button routerLink="/">
          <mat-icon>arrow_back</mat-icon>
          Create your own poll
        </a>
      </nav>
      @if (poll() === undefined) {
        <mat-spinner class="spinner" diameter="40" />
      } @else if (poll(); as poll) {
        <rap-poll-vote [poll]="poll" />
      } @else {
        <mat-card
          appearance="outlined"
          class="not-found"
          data-testid="poll-not-found"
        >
          <mat-icon class="not-found-icon" aria-hidden="true"
            >search_off</mat-icon
          >
          <mat-card-header>
            <mat-card-title>Poll not found</mat-card-title>
            <mat-card-subtitle>
              It may have expired or the link is wrong.
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-actions>
            <a mat-flat-button routerLink="/">Create a new poll</a>
          </mat-card-actions>
        </mat-card>
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
    nav {
      margin-inline-start: -0.75rem;
    }
    .spinner {
      align-self: center;
      margin-block: 3rem;
    }
    .not-found {
      align-items: center;
      gap: 0.5rem;
      padding: 2.5rem 1rem 1.5rem;
      text-align: center;
    }
    .not-found-icon {
      width: 3rem;
      height: 3rem;
      font-size: 3rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PollPageComponent {
  private readonly pollsRepo = inject(PollsRepoPort);
  private readonly injector = inject(Injector);

  private readonly pollId$ = inject(ActivatedRoute).paramMap.pipe(
    map((params) => params.get('pollId') ?? '')
  );
  private readonly pollId = toSignal(this.pollId$, { initialValue: '' });

  protected readonly poll = toSignal(
    this.pollId$.pipe(
      switchMap((pollId) =>
        this.pollsRepo.watchPoll(pollId).pipe(
          pendingUntilFirstValue(this.injector, SSR_POLL_TIMEOUT_MS),
          // forget the previous poll while the next one loads
          startWith(undefined)
        )
      )
    )
  );

  constructor() {
    usePollMetaTags(this.poll, this.pollId);
  }
}
