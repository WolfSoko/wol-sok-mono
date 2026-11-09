import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SpielComponent } from '../../spiel-seite/spiel.component';

/** `/spiel/{id}`: a Spiel's result, quarters, Halle and both Kader. */
@Component({
  selector: 'korb-spiel-page',
  imports: [SpielComponent],
  template: `<korb-spiel [spielId]="id()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SpielPage {
  /** The route's `:id`, bound by `withComponentInputBinding`. */
  public readonly id = input.required<string>();
}
