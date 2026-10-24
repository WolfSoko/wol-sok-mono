import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Poll, PRIVATE_POLL_HINT } from '../../../shared/poll';
import { pollUrl } from '../../../shared/site-url';
import { ShareContent } from '../../ports/share-target.port';
import { injectShareOrigin, ShareComponent } from '../share/share.component';

/** Invites to vote on a poll, see {@link ShareComponent}. */
@Component({
  selector: 'rap-poll-share',
  imports: [MatIconModule, ShareComponent],
  templateUrl: './poll-share.component.html',
  styleUrl: './poll-share.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PollShareComponent {
  public readonly poll = input.required<Poll>();
  /** Right after creating a poll, sharing is the one thing left to do. */
  public readonly highlighted = input(false, { transform: booleanAttribute });

  private readonly origin = injectShareOrigin();
  protected readonly privatePollHint: string = PRIVATE_POLL_HINT;

  protected readonly content = computed<ShareContent>(() => {
    const { id, question } = this.poll();
    return {
      url: pollUrl(id, this.origin),
      title: question,
      text: `Vote now: ${question}`,
    };
  });
}
