import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
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
    MatProgressSpinnerModule,
    PollVoteComponent,
    RouterLink,
  ],
  template: `
    <main class="main">
      <nav>
        <a mat-button routerLink="/" data-testid="home-link">← RollaPolla</a>
      </nav>
      @if (poll() === undefined) {
        <mat-spinner class="spinner" />
      } @else if (poll(); as poll) {
        <rap-poll-vote [poll]="poll" />
      } @else {
        <mat-card data-testid="poll-not-found">
          <mat-card-header>
            <mat-card-title>Poll not found</mat-card-title>
            <mat-card-subtitle>
              It may have expired or the link is wrong.
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-actions>
            <a mat-button routerLink="/">Create a new poll</a>
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
    }
    .spinner {
      align-self: center;
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
