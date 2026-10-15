import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { pendingUntilFirstValue } from '../../adapter/pending-until-first-value';
import { PollsRepoPort } from '../../ports/polls-repo.port';
import { PollListComponent } from '../poll-list/poll-list.component';

const HOT_POLLS_COUNT = 5;
/** Longest the server waits for the polls before it renders without them. */
const SSR_TIMEOUT_MS = 1500;

/** The open listed polls with the most votes. */
@Component({
  selector: 'rap-hot-polls',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PollListComponent,
    RouterLink,
  ],
  template: `
    @if (polls(); as polls) {
      @if (polls.length) {
        <rap-poll-list
          [polls]="polls"
          ranked
          testIdPrefix="hot-poll-"
          data-testid="hot-polls"
        />
      } @else {
        <p class="empty" data-testid="hot-polls-empty">
          No hot polls right now. Create one and get it going!
        </p>
      }
    } @else if (polls() === undefined) {
      <mat-spinner class="spinner" diameter="40" />
    }
    <a mat-stroked-button class="browse" routerLink="/polls">
      <mat-icon>search</mat-icon>
      Browse all polls
    </a>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .empty {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .spinner {
      align-self: center;
    }
    .browse {
      align-self: flex-start;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HotPollsComponent {
  /** `undefined` while loading, `null` if they could not be loaded. */
  protected readonly polls = toSignal(
    inject(PollsRepoPort)
      .watchHotPolls(HOT_POLLS_COUNT)
      .pipe(
        pendingUntilFirstValue(inject(Injector), SSR_TIMEOUT_MS),
        catchError((error: unknown) => {
          console.error('Could not load hot polls', error);
          return of(null);
        })
      )
  );
}
