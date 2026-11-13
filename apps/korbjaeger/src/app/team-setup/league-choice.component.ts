import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type { League } from '@wolsok/feat-shared-basketball-data';
import { errorText, NO_LEAGUES } from '../errors/error-text';
import { leagueDescription } from './league-description';
import type { LeaguePages } from './league-pages';

/**
 * The Ligen of a filter, page by page, to pick one of. Shows the pages it
 * is given (`leaguePages`), which outlive it: back from a picked Liga,
 * the pages read are still there.
 */
@Component({
  selector: 'korb-league-choice',
  imports: [MatButtonModule, MatListModule, MatProgressBarModule],
  template: `
    @let leaguePages = pages();
    @if (leaguePages.leagues().length > 0) {
      <mat-action-list class="umbrechende-liste">
        @for (league of leaguePages.leagues(); track league.id) {
          <button
            mat-list-item
            type="button"
            data-qa="league"
            (click)="chosen.emit(league)"
          >
            <span matListItemTitle>{{ league.name }}</span>
            <span matListItemLine>{{ description(league) }}</span>
          </button>
        }
      </mat-action-list>
    }
    @if (leaguePages.loading()) {
      <mat-progress-bar
        mode="indeterminate"
        aria-label="Ligen werden geladen"
      />
    } @else if (leaguePages.more()) {
      <button
        matButton="outlined"
        type="button"
        (click)="leaguePages.loadMore()"
      >
        Weitere Ligen
      </button>
    }
    @if (error(); as text) {
      <p class="fehler" role="alert">{{ text }}</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeagueChoiceComponent {
  /** The Ligen of the Verband, age group and gender picked. */
  public readonly pages = input.required<LeaguePages>();
  /** The Liga tapped. */
  public readonly chosen = output<League>();

  protected readonly description = leagueDescription;

  protected readonly error = computed(() =>
    errorText(this.pages().error(), NO_LEAGUES)
  );
}
