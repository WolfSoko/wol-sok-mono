import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { parseDbbId } from '@wolsok/feat-shared-basketball-data';
import { vereinsTeamsResource } from '../basketball-data/vereins-teams-resource';
import { KEIN_VEREIN } from '../fehler/fehler-text';
import { breadcrumb } from '../navigation/breadcrumb';
import { VereinsTeamsComponent } from '../verein/vereins-teams.component';
import { vereinsTeamsStand } from '../verein/vereins-teams-stand';
import { StandComponent } from '../stand/stand.component';
import { SEARCH_LEVEL } from './search-level';

/** What the page is titled before the Verein's name is read. */
const CLUB_TITLE = 'Verein';

/**
 * A Verein found by the search: its name and its Teams (those its recent
 * Spiele show), each to open and to follow.
 */
@Component({
  selector: 'korb-club-page',
  imports: [StandComponent, VereinsTeamsComponent],
  template: `
    <h1 data-qa="club-name">{{ title() }}</h1>
    @if (stand(); as stand) {
      <korb-stand data-qa="vereins-stand" [stand]="teams.stand()" />
      <korb-vereins-teams
        data-qa="vereins-teams"
        [stand]="stand"
        emptyText="Keine Teams des Vereins in den letzten Wochen."
      />
    } @else {
      <p data-qa="vereins-teams-fehler">{{ unknownClub }}</p>
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

  protected readonly unknownClub = KEIN_VEREIN;

  private readonly club = computed(() => parseDbbId(this.clubId()));
  protected readonly teams = vereinsTeamsResource(() => this.club());

  /** The read's stand; none for an id that is no DBB id. */
  protected readonly stand = computed(() =>
    this.club() === undefined ? undefined : vereinsTeamsStand(this.teams)
  );

  protected readonly title = computed(() =>
    this.teams.hasValue() ? this.teams.value().verein.name : CLUB_TITLE
  );

  public constructor() {
    breadcrumb(() => [SEARCH_LEVEL, { title: this.title() }]);
  }
}
