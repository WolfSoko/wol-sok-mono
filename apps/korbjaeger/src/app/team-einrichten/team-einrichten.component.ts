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
import { FacettenSelectComponent } from './facetten-select.component';
import { facettenSchritt } from './facetten-schritt';
import { ligenSeiten } from './ligen-seiten';
import { ligaBeschreibung } from './liga-beschreibung';
import { LigaTeamsComponent } from './liga-teams.component';
import { LigaWahlComponent } from './liga-wahl.component';

/**
 * Finds a Team without its id, step by step: a Verband, then one of the
 * age groups and genders it has, then a Liga of those, then a Team of
 * that Liga, which one tap follows (`LigaTeamsComponent`). Each step
 * offers only what the DBB's Liga search finds for the picks before it;
 * changing a pick starts over below it.
 */
@Component({
  selector: 'korb-team-einrichten',
  imports: [
    FacettenSelectComponent,
    LigaTeamsComponent,
    LigaWahlComponent,
    MatButtonModule,
    MatProgressBarModule,
  ],
  templateUrl: './team-einrichten.component.html',
  styleUrl: './team-einrichten.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamEinrichtenComponent {
  protected readonly verband = signal<AssociationId | undefined>(undefined);
  protected readonly altersklasse = linkedSignal<
    AssociationId | undefined,
    AgeGroupId | undefined
  >({ source: this.verband, computation: () => undefined });
  protected readonly geschlecht = linkedSignal<
    AgeGroupId | undefined,
    AgeGroupGenderId | undefined
  >({ source: this.altersklasse, computation: () => undefined });

  /** Each step's filter: its pick added to the last; none until made. */
  private readonly verbandFilter = computed(() =>
    eingeengt(NO_LEAGUE_FILTER, 'associationIds', this.verband())
  );
  private readonly altersklasseFilter = computed(() =>
    eingeengt(this.verbandFilter(), 'ageGroupIds', this.altersklasse())
  );
  /** The filter the Ligen are listed for, once all three are picked. */
  protected readonly ligaFilter = computed(() =>
    eingeengt(this.altersklasseFilter(), 'ageGroupGenderIds', this.geschlecht())
  );

  /**
   * The Ligen of `ligaFilter`, page by page; kept here, so going back from
   * a picked Liga shows the pages already read.
   */
  protected readonly ligen = ligenSeiten(() => this.ligaFilter());

  protected readonly liga = linkedSignal<
    LeagueSearchFilter | undefined,
    League | undefined
  >({ source: this.ligaFilter, computation: () => undefined });

  protected readonly verbaende = facettenSchritt(
    () => NO_LEAGUE_FILTER,
    'associations',
    NO_ASSOCIATIONS
  );
  protected readonly altersklassen = facettenSchritt(
    () => this.verbandFilter(),
    'ageGroups',
    NO_LEAGUES_IN_ASSOCIATION
  );
  protected readonly geschlechter = facettenSchritt(
    () => this.altersklasseFilter(),
    'ageGroupGenders',
    NO_LEAGUES_IN_AGE_GROUP
  );

  protected readonly laedt = computed(() =>
    [this.verbaende, this.altersklassen, this.geschlechter].some((schritt) =>
      schritt.laedt()
    )
  );

  protected readonly beschreibung = ligaBeschreibung;
}

/**
 * `davor` narrowed to `pick` in its list `liste`; none while either is
 * missing, so a step's filter waits for the steps before it.
 */
function eingeengt<K extends keyof LeagueSearchFilter>(
  davor: LeagueSearchFilter | undefined,
  liste: K,
  pick: LeagueSearchFilter[K][number] | undefined
): LeagueSearchFilter | undefined {
  return davor === undefined || pick === undefined
    ? undefined
    : { ...davor, [liste]: [pick] };
}
