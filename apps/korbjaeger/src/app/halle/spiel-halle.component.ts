import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { HalleComponent } from './halle.component';
import type { HallenStand } from './hallen-stand';

/**
 * A Spiel's Halle as its read stands (`stand`): loading, why it failed, or
 * the Halle. Reads nothing itself; the screen holding the read passes it.
 */
@Component({
  selector: 'korb-spiel-halle',
  imports: [HalleComponent, MatProgressBarModule],
  template: `
    @let halle = stand();
    @switch (halle.art) {
      @case ('laedt') {
        <mat-progress-bar
          mode="indeterminate"
          aria-label="Halle wird geladen"
        />
      }
      @case ('fehler') {
        <p class="fehler" data-qa="halle-fehler">{{ halle.text }}</p>
      }
      @case ('gelesen') {
        <korb-halle [halle]="halle.halle" />
      }
    }
  `,
  styles: `
    p {
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpielHalleComponent {
  public readonly stand = input.required<HallenStand>();
}
