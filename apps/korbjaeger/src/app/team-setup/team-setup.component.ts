import {
  ChangeDetectionStrategy,
  Component,
  computed,
  linkedSignal,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  NO_LEAGUE_FILTER,
  type AgeGroupGenderId,
  type AgeGroupId,
  type League,
  type LeagueSearchFilter,
  type AssociationId,
} from '@wolsok/feat-shared-basketball-data';
import {
  NO_LEAGUES_IN_ASSOCIATION,
  NO_LEAGUES_IN_AGE_GROUP,
  NO_ASSOCIATIONS,
} from '../errors/error-text';
import { FacetSelectComponent } from './facet-select.component';
import { facetStep } from './facet-step';
import { leaguePages } from './league-pages';
import { leagueDescription } from './league-description';
import { LeagueTeamsComponent } from './league-teams.component';
import { LeagueChoiceComponent } from './league-choice.component';

/**
 * Finds a Team without its id, step by step: a Verband, then one of the
 * age groups and genders it has, then a Liga of those, then a Team of
 * that Liga, which one tap follows (`LeagueTeamsComponent`). Each step
 * offers only what the DBB's Liga search finds for the picks before it;
 * changing a pick starts over below it.
 */
@Component({
  selector: 'korb-team-setup',
  imports: [
    FacetSelectComponent,
    LeagueTeamsComponent,
    LeagueChoiceComponent,
    MatButtonModule,
    MatProgressBarModule,
  ],
  templateUrl: './team-setup.component.html',
  styleUrl: './team-setup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamSetupComponent {
  protected readonly association = signal<AssociationId | undefined>(undefined);
  protected readonly ageGroup = linkedSignal<
    AssociationId | undefined,
    AgeGroupId | undefined
  >({ source: this.association, computation: () => undefined });
  protected readonly gender = linkedSignal<
    AgeGroupId | undefined,
    AgeGroupGenderId | undefined
  >({ source: this.ageGroup, computation: () => undefined });

  /** Each step's filter: its pick added to the last; none until made. */
  private readonly associationFilter = computed(() =>
    narrowed(NO_LEAGUE_FILTER, 'associationIds', this.association())
  );
  private readonly ageGroupFilter = computed(() =>
    narrowed(this.associationFilter(), 'ageGroupIds', this.ageGroup())
  );
  /** The filter the Ligen are listed for, once all three are picked. */
  protected readonly leagueFilter = computed(() =>
    narrowed(this.ageGroupFilter(), 'ageGroupGenderIds', this.gender())
  );

  /**
   * The Ligen of `leagueFilter`, page by page; kept here, so going back from
   * a picked Liga shows the pages already read.
   */
  protected readonly leagues = leaguePages(() => this.leagueFilter());

  protected readonly league = linkedSignal<
    LeagueSearchFilter | undefined,
    League | undefined
  >({ source: this.leagueFilter, computation: () => undefined });

  protected readonly associations = facetStep(
    () => NO_LEAGUE_FILTER,
    'associations',
    NO_ASSOCIATIONS
  );
  protected readonly ageGroups = facetStep(
    () => this.associationFilter(),
    'ageGroups',
    NO_LEAGUES_IN_ASSOCIATION
  );
  protected readonly genders = facetStep(
    () => this.ageGroupFilter(),
    'ageGroupGenders',
    NO_LEAGUES_IN_AGE_GROUP
  );

  protected readonly loading = computed(() =>
    [this.associations, this.ageGroups, this.genders].some((step) =>
      step.loading()
    )
  );

  protected readonly description = leagueDescription;
}

/**
 * `previous` narrowed to `pick` in its list `list`; none while either is
 * missing, so a step's filter waits for the steps before it.
 */
function narrowed<K extends keyof LeagueSearchFilter>(
  previous: LeagueSearchFilter | undefined,
  list: K,
  pick: LeagueSearchFilter[K][number] | undefined
): LeagueSearchFilter | undefined {
  return previous === undefined || pick === undefined
    ? undefined
    : { ...previous, [list]: [pick] };
}
