import { ChangeDetectionStrategy, Component } from '@angular/core';
import { breadcrumb } from '../navigation/breadcrumb';
import { SEARCH_LEVEL } from '../search/search-level';
import { TeamSetupComponent } from '../team-setup/team-setup.component';

/**
 * `/team-einrichten`: finds a Team without its id, from Verband to Team,
 * and follows it; one of the search's ways in.
 */
@Component({
  selector: 'korb-team-setup-page',
  imports: [TeamSetupComponent],
  template: `<korb-team-setup />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class TeamSetupPage {
  public constructor() {
    breadcrumb(() => [SEARCH_LEVEL, { title: 'Team einrichten' }]);
  }
}
