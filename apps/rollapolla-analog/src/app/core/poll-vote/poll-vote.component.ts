import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
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
import { Poll } from '../../../shared/poll';
import { PollsRepoPort } from '../../ports/polls-repo.port';
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

  protected readonly selectedOption = signal<number | undefined>(undefined);
  protected readonly voting = signal(false);
  protected readonly voteFailed = signal(false);

  /** The vote stored on the server wins over the hint this browser remembers. */
  private readonly ownVote = toSignal(
    toObservable(this.poll).pipe(
      map((poll) => poll.id),
      distinctUntilChanged(),
      switchMap((pollId) => this.pollsRepo.watchOwnVote(pollId))
    )
  );
  protected readonly votedOption = computed(
    () => this.ownVote() ?? this.votedPolls.votedOption(this.poll().id)
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
      this.votedPolls.rememberVote(poll.id, optionIndex);
      saved.catch((error: unknown) => this.voteRejected(poll.id, error));
    } catch (error) {
      console.error('Could not vote', error);
      this.voteFailed.set(true);
    } finally {
      this.voting.set(false);
    }
  }

  /**
   * The backend refused the vote after it was already shown. If this visitor
   * voted before (another tab), the stored vote takes over; otherwise retry.
   */
  private voteRejected(pollId: string, error: unknown): void {
    console.error('Vote was rejected', error);
    this.votedPolls.forgetVote(pollId);
    if (this.ownVote() === undefined) {
      this.voteFailed.set(true);
    }
  }
}
