import { ChangeDetectionStrategy, Component } from '@angular/core';
import { breadcrumb } from '../navigation/breadcrumb';
import { SEARCH_LEVEL } from '../search/search-level';
import { TeamEinrichtenComponent } from '../team-einrichten/team-einrichten.component';

/**
 * `/team-einrichten`: finds a Team without its id, from Verband to Team,
 * and follows it; one of the search's ways in.
 */
@Component({
  selector: 'korb-team-einrichten-page',
  imports: [TeamEinrichtenComponent],
  template: `<korb-team-einrichten />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class TeamEinrichtenPage {
  public constructor() {
    breadcrumb(() => [SEARCH_LEVEL, { title: 'Team einrichten' }]);
  }
}
