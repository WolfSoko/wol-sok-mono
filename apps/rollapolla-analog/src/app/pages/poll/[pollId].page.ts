import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
} from '@angular/core';
import { pendingUntilEvent, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { PollVoteComponent } from '../../core/poll-vote/poll-vote.component';
import { PollsRepoPort } from '../../ports/polls-repo.port';

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

  protected readonly poll = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => params.get('pollId') ?? ''),
      // keeps server rendering waiting until the poll arrived
      switchMap((pollId) =>
        this.pollsRepo.watchPoll(pollId).pipe(pendingUntilEvent(this.injector))
      )
    )
  );
}
