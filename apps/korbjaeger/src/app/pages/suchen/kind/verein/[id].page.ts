import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ClubPageComponent } from '../../../../search/club-page.component';

/**
 * `/suchen/kind/verein/{id}`: a Verein the search "Über mein Kind" found,
 * its Teams to follow and then to mark the Kind in.
 */
@Component({
  selector: 'korb-child-search-club-route',
  imports: [ClubPageComponent],
  template: `<korb-club-page [clubId]="id()" [forChild]="true" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ChildSearchClubPage {
  /** The route's `:id`, bound by `withComponentInputBinding`. */
  public readonly id = input.required<string>();
}
