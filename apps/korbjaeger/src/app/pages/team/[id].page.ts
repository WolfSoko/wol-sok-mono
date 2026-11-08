import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TeamSpieleComponent } from '../../team/team-spiele.component';

/** `/team/{id}`: a Team's Spiele of the Saison. */
@Component({
  selector: 'korb-team-page',
  imports: [TeamSpieleComponent],
  template: `<korb-team-spiele [teamId]="id()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class TeamPage {
  /** The route's `:id`, bound by `withComponentInputBinding`. */
  public readonly id = input.required<string>();
}
