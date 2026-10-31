import { DatePipe } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Poll } from '../../../shared/poll';
import {
  injectRollaPollaAnalytics,
  PollListName,
  pollOpened,
} from '../analytics/rollapolla-analytics';

/** Polls as links: question, votes and how long they still run. */
@Component({
  selector: 'rap-poll-list',
  imports: [DatePipe, MatIconModule, RouterLink],
  template: `
    <ul class="polls">
      @for (poll of polls(); track poll.id; let rank = $index) {
        <li>
          <a
            class="poll"
            [routerLink]="['/poll', poll.id]"
            [attr.data-testid]="testIdPrefix() + poll.id"
            (click)="opened(rank)"
          >
            @if (ranked()) {
              <span class="rank" aria-hidden="true">{{ rank + 1 }}</span>
            }
            <span class="body">
              <span class="question">{{ poll.question }}</span>
              <span class="meta">
                <mat-icon class="meta-icon" aria-hidden="true"
                  >how_to_vote</mat-icon
                >
                {{ poll.totalVotes }}
                {{ poll.totalVotes === 1 ? 'vote' : 'votes' }} · open until
                {{ poll.closesAt | date: 'mediumDate' }}
              </span>
            </span>
            <mat-icon class="chevron" aria-hidden="true"
              >chevron_right</mat-icon
            >
          </a>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }
    .polls {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .poll {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.875rem 1rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--rap-radius-md);
      background: var(--mat-sys-surface-container-lowest);
      color: inherit;
      text-decoration: none;
      transition: border-color 150ms ease;

      &:hover,
      &:focus-visible {
        border-color: var(--mat-sys-primary);
      }
      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;
      }
    }
    .rank {
      flex: none;
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      font: var(--mat-sys-title-small);
      font-weight: 700;
      color: var(--mat-sys-on-primary-container);
      background: var(--mat-sys-primary-container);
    }
    .body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 0;
    }
    .question {
      font: var(--mat-sys-title-medium);
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .meta {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .meta-icon {
      width: 1rem;
      height: 1rem;
      font-size: 1rem;
    }
    .chevron {
      flex: none;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PollListComponent {
  public readonly polls = input.required<readonly Poll[]>();
  /** Numbers the polls, for a ranking. */
  public readonly ranked = input(false, { transform: booleanAttribute });
  public readonly testIdPrefix = input('poll-link-');
  /** Which list this is, for the usage statistics. */
  public readonly list = input.required<PollListName>();

  private readonly analytics = injectRollaPollaAnalytics();

  protected opened(position: number): void {
    this.analytics.track('select_content', pollOpened(this.list(), position));
  }
}
