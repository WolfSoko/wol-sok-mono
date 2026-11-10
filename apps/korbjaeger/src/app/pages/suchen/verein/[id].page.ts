import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ClubPageComponent } from '../../../search/club-page.component';

/** `/suchen/verein/{id}`: a Verein the search found, with its Teams. */
@Component({
  selector: 'korb-suchen-verein-page',
  imports: [ClubPageComponent],
  template: `<korb-club-page [clubId]="id()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SuchenVereinPage {
  /** The route's `:id`, bound by `withComponentInputBinding`. */
  public readonly id = input.required<string>();
}
