import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  linkedSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, startWith, switchMap } from 'rxjs';
import {
  pendingUntilFirstValue,
  SSR_DATA_TIMEOUT_MS,
} from '../../adapter/pending-until-first-value';
import { CreatePollComponent } from '../../core/create-poll/create-poll.component';
import { CREATED_POLL_ID } from '../../core/create-poll/created-poll-id';
import { PollChatComponent } from '../../core/poll-chat/poll-chat.component';
import { PollOwnerActionsComponent } from '../../core/poll-owner-actions/poll-owner-actions.component';
import { PollVoteComponent } from '../../core/poll-vote/poll-vote.component';
import { AccountPort } from '../../ports/account.port';
import { PollsRepoPort } from '../../ports/polls-repo.port';
import { usePollMetaTags } from './poll-meta';

@Component({
  selector: 'rap-poll-page',
  imports: [
    CreatePollComponent,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PollChatComponent,
    PollOwnerActionsComponent,
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
        <a mat-button routerLink="/polls" data-testid="browse-polls-link">
          <mat-icon>search</mat-icon>
          More polls
        </a>
      </nav>
      @if (poll() === undefined) {
        <mat-spinner class="spinner" diameter="40" />
      } @else if (poll(); as poll) {
        @if (editing()) {
          <rap-create-poll [poll]="poll" (editDone)="editing.set(false)" />
        } @else {
          @if (isOwnPoll()) {
            <rap-poll-owner-actions [poll]="poll" (edit)="editing.set(true)" />
          }
          <rap-poll-vote [poll]="poll" [justCreated]="justCreated()" />
        }
        @defer (on viewport) {
          <rap-poll-chat [poll]="poll" />
        } @placeholder {
          <mat-spinner class="spinner" diameter="40" />
        }
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
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      margin-inline: -0.75rem;
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
  private readonly createdPollId =
    inject(Router).currentNavigation()?.extras.state?.[CREATED_POLL_ID];
  protected readonly justCreated = computed(
    () => this.pollId() === this.createdPollId
  );

  protected readonly poll = toSignal(
    this.pollId$.pipe(
      switchMap((pollId) =>
        this.pollsRepo.watchPoll(pollId).pipe(
          pendingUntilFirstValue(this.injector, SSR_DATA_TIMEOUT_MS),
          // forget the previous poll while the next one loads
          startWith(undefined)
        )
      )
    )
  );

  private readonly account = toSignal(inject(AccountPort).account$);
  /** Featured polls belong to RollaPolla, never to a visitor. */
  protected readonly isOwnPoll = computed(() => {
    const poll = this.poll();
    return !!poll && poll.creatorUid === this.account()?.uid;
  });
  /** The creator edits the poll in place; another poll ends the editing. */
  protected readonly editing = linkedSignal({
    source: this.pollId,
    computation: () => false,
  });

  constructor() {
    usePollMetaTags(this.poll, this.pollId);
  }
}
