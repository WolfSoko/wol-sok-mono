import { DOCUMENT } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { Poll } from '../../../shared/poll';
import { PollsRepoPort } from '../../ports/polls-repo.port';
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
  ],
  templateUrl: './poll-vote.component.html',
  styleUrl: './poll-vote.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PollVoteComponent {
  public readonly poll = input.required<Poll>();

  private readonly pollsRepo = inject(PollsRepoPort);
  private readonly votedPolls = inject(VotedPollsStore);
  private readonly clipboard = inject(Clipboard);
  private readonly document = inject(DOCUMENT);

  protected readonly selectedOption = signal<number | undefined>(undefined);
  protected readonly linkCopied = signal(false);

  protected readonly votedOption = computed(() =>
    this.votedPolls.votedOption(this.poll().id)
  );
  protected readonly hasVoted = computed(
    () => this.votedOption() !== undefined
  );

  protected readonly results = computed<OptionResult[]>(() => {
    const { options, counts, totalVotes } = this.poll();
    return options.map((label, index) => {
      const count = counts[index] ?? 0;
      return {
        index,
        label,
        count,
        percent: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
      };
    });
  });

  protected vote(): void {
    const optionIndex = this.selectedOption();
    if (optionIndex === undefined || this.hasVoted()) {
      return;
    }
    const pollId = this.poll().id;
    this.pollsRepo.vote(pollId, optionIndex);
    this.votedPolls.rememberVote(pollId, optionIndex);
  }

  protected copyLink(): void {
    this.linkCopied.set(this.clipboard.copy(this.document.location.href));
  }
}
