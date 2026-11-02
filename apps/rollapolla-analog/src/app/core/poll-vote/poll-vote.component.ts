import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { distinctUntilChanged, map, switchMap } from 'rxjs';
import { isFeaturedPoll } from '../../../shared/featured-polls';
import { Poll } from '../../../shared/poll';
import { PollsRepoPort } from '../../ports/polls-repo.port';
import { injectRollaPollaAnalytics } from '../analytics/rollapolla-analytics';
import { PollShareComponent } from '../poll-share/poll-share.component';
import { percentages } from './percentages';
import { VotedPollsStore } from './voted-polls.store';

type OptionResult = {
  index: number;
  label: string;
  count: number;
  percent: number;
};

@Component({
  selector: 'rap-poll-vote',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatRadioModule,
    PollShareComponent,
  ],
  templateUrl: './poll-vote.component.html',
  styleUrl: './poll-vote.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PollVoteComponent {
  public readonly poll = input.required<Poll>();
  /** The visitor just created this poll: put sharing first. */
  public readonly justCreated = input(false);

  private readonly pollsRepo = inject(PollsRepoPort);
  private readonly votedPolls = inject(VotedPollsStore);
  private readonly analytics = injectRollaPollaAnalytics();

  /** Dropped when the creator edits the poll: the answers may have changed. */
  protected readonly selectedOption = linkedSignal<Poll, number | undefined>({
    // a live vote count is no reason to drop it, only another poll or round
    source: computed(() => this.poll(), {
      equal: (a, b) => a.id === b.id && a.round === b.round,
    }),
    computation: () => undefined,
  });
  protected readonly voting = signal(false);
  protected readonly voteFailed = signal(false);

  private readonly storedVote = toSignal(
    toObservable(this.poll).pipe(
      map((poll) => poll.id),
      distinctUntilChanged(),
      switchMap((pollId) => this.pollsRepo.watchOwnVote(pollId))
    )
  );
  /** The stored vote, if cast in this round: editing the poll resets votes. */
  private readonly ownVote = computed(() => {
    const vote = this.storedVote();
    return vote?.round === this.poll().round ? vote.option : undefined;
  });
  /** The vote stored on the server wins over the hint this browser remembers. */
  protected readonly votedOption = computed(
    () => this.ownVote() ?? this.votedPolls.votedOption(this.poll())
  );
  protected readonly hasVoted = computed(
    () => this.votedOption() !== undefined
  );

  protected readonly results = computed<OptionResult[]>(() => {
    const { options, counts } = this.poll();
    const optionCounts = options.map((_, index) => counts[index] ?? 0);
    const percents = percentages(optionCounts);
    return options.map((label, index) => ({
      index,
      label,
      count: optionCounts[index],
      percent: percents[index],
    }));
  });

  protected async vote(): Promise<void> {
    const optionIndex = this.selectedOption();
    if (optionIndex === undefined || this.hasVoted() || this.voting()) {
      return;
    }
    const poll = this.poll();
    this.voting.set(true);
    this.voteFailed.set(false);
    try {
      const { saved } = await this.pollsRepo.vote(poll, optionIndex);
      this.votedPolls.rememberVote(poll, optionIndex);
      this.analytics.track('vote', {
        options: poll.options.length,
        featured: isFeaturedPoll(poll),
        just_created: this.justCreated(),
      });
      saved.catch((error: unknown) => this.voteRejected(poll, error));
    } catch (error) {
      console.error('Could not vote', error);
      this.analytics.track('vote_failed', { late: false });
      this.voteFailed.set(true);
    } finally {
      this.voting.set(false);
    }
  }

  /**
   * The backend refused the vote after it was already shown. If this visitor
   * voted before (another tab), the stored vote takes over; otherwise retry.
   */
  private voteRejected(poll: Poll, error: unknown): void {
    console.error('Vote was rejected', error);
    this.analytics.track('vote_failed', { late: true });
    this.votedPolls.forgetVote(poll);
    if (this.ownVote() === undefined) {
      this.voteFailed.set(true);
    }
  }
}
