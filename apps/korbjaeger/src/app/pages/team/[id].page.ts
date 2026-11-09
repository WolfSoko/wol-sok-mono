import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TeamComponent } from '../../team/team.component';

/** `/team/{id}`: a Team's Spiele of the Saison and the Tabellen of its Ligen. */
@Component({
  selector: 'korb-team-page',
  imports: [TeamComponent],
  template: `<korb-team [teamId]="id()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class TeamPage {
  /** The route's `:id`, bound by `withComponentInputBinding`. */
  public readonly id = input.required<string>();
}
