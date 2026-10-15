import { DOCUMENT } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
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
import { percentages } from './percentages';
import { VotedPollsStore } from './voted-polls.store';

const LINK_COPIED_RESET_MS = 2000;

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
  protected readonly voting = signal(false);
  protected readonly voteFailed = signal(false);
  protected readonly linkCopied = signal(false);
  private linkCopiedTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.linkCopiedTimer));
  }

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
      await this.pollsRepo.vote(poll, optionIndex);
      this.votedPolls.rememberVote(poll.id, optionIndex);
    } catch (error) {
      console.error('Could not vote', error);
      this.voteFailed.set(true);
    } finally {
      this.voting.set(false);
    }
  }

  protected copyLink(): void {
    clearTimeout(this.linkCopiedTimer);
    const copied = this.clipboard.copy(this.document.location.href);
    this.linkCopied.set(copied);
    if (copied) {
      this.linkCopiedTimer = setTimeout(
        () => this.linkCopied.set(false),
        LINK_COPIED_RESET_MS
      );
    }
  }
}
