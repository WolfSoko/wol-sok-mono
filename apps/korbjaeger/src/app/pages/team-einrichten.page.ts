import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TeamEinrichtenComponent } from '../team-einrichten/team-einrichten.component';

/**
 * `/team-einrichten`: finds a Team without its id, from Verband to Team,
 * and follows it.
 */
@Component({
  selector: 'korb-team-einrichten-page',
  imports: [TeamEinrichtenComponent],
  template: `<korb-team-einrichten />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class TeamEinrichtenPage {}
