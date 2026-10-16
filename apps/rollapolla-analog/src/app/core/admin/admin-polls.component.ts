import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { isOpen, Poll } from '../../../shared/poll';
import { AdminPort } from '../../ports/admin.port';
import { EndlessScroll } from '../endless-scroll/endless-scroll';
import { EndlessScrollEndComponent } from '../endless-scroll/endless-scroll-end.component';
import { AdminWrites } from './admin-writes';
import { endlessItems } from './endless-items';

/** Every poll, listed or not, newest first, to delete the unwanted ones. */
@Component({
  selector: 'rap-admin-polls',
  imports: [
    DatePipe,
    EndlessScrollEndComponent,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  template: `
    @if (failed()) {
      <p class="error" role="alert" data-testid="admin-polls-error">
        The polls could not be loaded. Trying again…
      </p>
    }
    @if (polls(); as polls) {
      @if (polls.length) {
        <ul class="list" data-testid="admin-polls">
          @for (poll of polls; track poll.id) {
            <li class="item" [attr.data-testid]="'admin-poll-' + poll.id">
              <div class="body">
                <a class="title" [routerLink]="['/poll', poll.id]">{{
                  poll.question
                }}</a>
                <span class="meta">
                  {{ poll.totalVotes }}
                  {{ poll.totalVotes === 1 ? 'vote' : 'votes' }} ·
                  {{ poll.listed ? 'listed' : 'unlisted' }} ·
                  {{ isOpen(poll) ? 'open' : 'closed' }} · created
                  {{ poll.createdAt | date: 'medium' }} · by
                  {{ poll.creatorUid }}
                </span>
              </div>
              <button
                mat-icon-button
                type="button"
                (click)="delete(poll)"
                aria-label="Delete poll"
                title="Delete poll"
                data-testid="admin-delete-poll"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </li>
          }
        </ul>
        <rap-endless-scroll-end [scroll]="scroll" />
      } @else {
        <p class="empty" data-testid="admin-polls-empty">No polls.</p>
      }
    } @else if (!failed()) {
      <mat-spinner class="spinner" diameter="40" />
    }
  `,
  styleUrl: './admin-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPollsComponent {
  private readonly admin = inject(AdminPort);
  private readonly writes = new AdminWrites();
  protected readonly isOpen = isOpen;
  protected readonly scroll = new EndlessScroll();
  private readonly page = endlessItems(
    this.scroll,
    this.admin.watchAllPolls(this.scroll.counts),
    'Could not load the polls'
  );
  protected readonly polls = this.page.items;
  protected readonly failed = this.page.failed;

  protected async delete(poll: Poll): Promise<void> {
    const confirmed = await this.writes.confirm({
      title: 'Delete this poll?',
      text: poll.question,
      action: 'Delete',
    });
    if (confirmed) {
      await this.writes.saved(
        this.admin.deletePoll(poll.id),
        'The poll could not be deleted.'
      );
    }
  }
}
