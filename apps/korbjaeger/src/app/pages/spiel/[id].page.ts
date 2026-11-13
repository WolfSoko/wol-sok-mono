import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GamePageComponent } from '../../game-page/game-page.component';

/** `/spiel/{id}`: a Spiel's result, quarters, Halle and both Kader. */
@Component({
  selector: 'korb-spiel-page',
  imports: [GamePageComponent],
  template: `<korb-game-page [gameId]="id()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SpielPage {
  /** The route's `:id`, bound by `withComponentInputBinding`. */
  public readonly id = input.required<string>();
}
