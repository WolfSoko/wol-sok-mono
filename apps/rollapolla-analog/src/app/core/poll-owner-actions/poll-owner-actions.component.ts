import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { isOpen, Poll } from '../../../shared/poll';
import { injectRollaPollaAnalytics } from '../analytics/rollapolla-analytics';
import { PollsRepoPort } from '../../ports/polls-repo.port';

/** What the creator of a poll may do with it: edit it while open, delete it. */
@Component({
  selector: 'rap-poll-owner-actions',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (confirmingDelete()) {
      <div class="bar confirm" role="alert" data-testid="delete-poll-confirm">
        <span class="label">
          Delete this poll for everyone? Its votes and chat go with it.
        </span>
        <span class="buttons">
          <button
            mat-button
            type="button"
            (click)="confirmingDelete.set(false)"
            data-testid="delete-poll-cancel"
          >
            Keep it
          </button>
          <button
            mat-flat-button
            type="button"
            class="delete-button"
            (click)="deletePoll()"
            data-testid="delete-poll-confirm-button"
          >
            <mat-icon>delete</mat-icon>
            Delete
          </button>
        </span>
      </div>
    } @else {
      <div class="bar">
        <span class="label">
          <mat-icon class="label-icon" aria-hidden="true">person</mat-icon>
          Your poll
        </span>
        <span class="buttons">
          @if (open() && editable()) {
            <button
              mat-button
              type="button"
              (click)="edit.emit()"
              data-testid="edit-poll-button"
            >
              <mat-icon>edit</mat-icon>
              Edit
            </button>
          }
          <button
            mat-button
            type="button"
            (click)="confirmingDelete.set(true)"
            data-testid="delete-poll-button"
          >
            <mat-icon>delete</mat-icon>
            Delete
          </button>
        </span>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.25rem 0.25rem 0.25rem 1rem;
      border-radius: var(--mat-sys-corner-large);
      background: var(--mat-sys-surface-container);
    }
    .confirm {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .label {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font: var(--mat-sys-label-large);
    }
    .label-icon {
      width: 1.25rem;
      height: 1.25rem;
      font-size: 1.25rem;
    }
    .buttons {
      display: flex;
      gap: 0.25rem;
      margin-inline-start: auto;
    }
    .delete-button {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
      --mat-button-filled-icon-color: var(--mat-sys-on-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PollOwnerActionsComponent {
  public readonly poll = input.required<Poll>();
  /** Off while an admin paused poll creation: an edit amounts to a new poll. */
  public readonly editable = input(true);
  /** The creator wants to edit the poll. */
  public readonly edit = output<void>();

  private readonly pollsRepo = inject(PollsRepoPort);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly analytics = injectRollaPollaAnalytics();

  /** Closed polls take no more votes, so there is nothing left to reset. */
  protected readonly open = computed(() => isOpen(this.poll()));
  protected readonly confirmingDelete = signal(false);

  /**
   * The poll disappears locally at once, so this page has nothing left to
   * show. Should the backend refuse, the poll comes back in "My polls".
   */
  protected deletePoll(): void {
    const { saved } = this.pollsRepo.deletePoll(this.poll().id);
    // counted once the backend took it
    saved.then(
      () => this.analytics.track('poll_deleted'),
      (error: unknown) => {
        console.error('Poll deletion was rejected', error);
        this.snackBar.open('Could not delete the poll.', 'OK');
      }
    );
    void this.router.navigate(['/my-polls']);
  }
}
