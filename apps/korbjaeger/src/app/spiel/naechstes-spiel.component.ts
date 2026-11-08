import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import type { HallenStand } from '../halle/hallen-stand';
import { SpielHalleComponent } from '../halle/spiel-halle.component';
import { SpielLinkComponent } from './spiel-link.component';
import type { SpielZeile } from './spiel-zeile';

/**
 * A Team's next Spiel, on the Team page and the overview alike: its line,
 * linking to its Spiel page, and its Halle with the way there, as the
 * screen's read of this Spiel's details gives it.
 */
@Component({
  selector: 'korb-naechstes-spiel',
  imports: [SpielHalleComponent, SpielLinkComponent],
  template: `
    <korb-spiel-link
      titel="Nächstes Spiel"
      [zeile]="zeile()"
      [mitLiga]="mitLiga()"
    />
    @if (halle(); as stand) {
      <korb-spiel-halle [stand]="stand" />
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NaechstesSpielComponent {
  public readonly zeile = input.required<SpielZeile>();
  /** The read of its Halle; none before it started. */
  public readonly halle = input<HallenStand>();
  /** Whether to name the Spiel's Liga. */
  public readonly mitLiga = input(false, { transform: booleanAttribute });
}
