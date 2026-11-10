import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ClubComponent } from '../../../search/club.component';

/** `/suchen/verein/{id}`: a Verein the search found, with its Teams to follow. */
@Component({
  selector: 'korb-club-page',
  imports: [ClubComponent],
  template: `<korb-club [clubId]="id()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ClubPage {
  /** The route's `:id`, bound by `withComponentInputBinding`. */
  public readonly id = input.required<string>();
}
