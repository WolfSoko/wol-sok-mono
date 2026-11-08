import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { SpielHalleComponent } from '../halle/spiel-halle.component';
import { SpielLinkComponent } from './spiel-link.component';
import type { SpielZeile } from './spiel-zeile';

/**
 * A Team's next Spiel, on the Team page and the overview alike: its line,
 * linking to its Spiel page, and its Halle with the way there, read for
 * this Spiel only.
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
    <korb-spiel-halle [spielId]="zeile().id" />
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
  /** Whether to name the Spiel's Liga. */
  public readonly mitLiga = input(false, { transform: booleanAttribute });
}
