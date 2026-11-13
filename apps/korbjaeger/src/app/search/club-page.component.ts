import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { parseDbbId } from '@wolsok/feat-shared-basketball-data';
import { clubTeamsResource } from '../basketball-data/club-teams-resource';
import { NO_CLUB } from '../errors/error-text';
import { breadcrumb } from '../navigation/breadcrumb';
import { ClubTeamDetailDirective } from '../club/club-team-detail.directive';
import { ClubTeamsComponent } from '../club/club-teams.component';
import { clubTeamsState } from '../club/club-teams-state';
import { AsOfComponent } from '../as-of/as-of.component';
import { ChildStepComponent } from './child-step.component';
import { CHILD_SEARCH_LEVEL, SEARCH_LEVEL } from './search-level';

/** What the page is titled before the Verein's name is read. */
const CLUB_TITLE = 'Verein';

/**
 * A Verein found by the search: its name and its Teams (those its recent
 * Spiele show), each to open and to follow. In the search "Über mein Kind"
 * (`forChild`), each followed Team leads on to marking the Kind.
 */
@Component({
  selector: 'korb-club-page',
  imports: [
    ChildStepComponent,
    AsOfComponent,
    ClubTeamDetailDirective,
    ClubTeamsComponent,
  ],
  template: `
    <h1 data-qa="club-name">{{ title() }}</h1>
    @if (state(); as state) {
      <korb-as-of data-qa="club-as-of" [asOf]="teams.asOf()" />
      @if (forChild() && state.kind === 'read' && state.teams.length > 0) {
        <p data-qa="child-search-follow-first">
          Folge zuerst dem Team deines Kindes, dann markierst du es im Kader.
        </p>
      }
      <korb-club-teams
        data-qa="club-teams"
        [state]="state"
        emptyText="Keine Teams des Vereins in den letzten Wochen."
      >
        <ng-template korbClubTeamDetail let-team>
          @if (forChild()) {
            <korb-child-step [teamId]="team.teamId" [teamName]="team.name" />
          }
        </ng-template>
      </korb-club-teams>
    } @else {
      <p data-qa="club-teams-error">{{ unknownClub }}</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 1rem;
    }
    h1,
    p {
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClubPageComponent {
  /** The Verein's DBB id, as the route gives it. */
  public readonly clubId = input.required<string>();
  /** Shown in the search "Über mein Kind", leading on to marking it. */
  public readonly forChild = input(false);

  protected readonly unknownClub = NO_CLUB;

  private readonly club = computed(() => parseDbbId(this.clubId()));
  protected readonly teams = clubTeamsResource(() => this.club());

  /** The read's state; none for an id that is no DBB id. */
  protected readonly state = computed(() =>
    this.club() === undefined ? undefined : clubTeamsState(this.teams)
  );

  protected readonly title = computed(() =>
    this.teams.hasValue() ? this.teams.value().club.name : CLUB_TITLE
  );

  public constructor() {
    breadcrumb(() => [
      SEARCH_LEVEL,
      ...(this.forChild() ? [CHILD_SEARCH_LEVEL] : []),
      { title: this.title() },
    ]);
  }
}
