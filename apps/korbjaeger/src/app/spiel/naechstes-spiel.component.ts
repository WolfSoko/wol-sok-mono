import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import type { VenueState } from '../venue/venue-state';
import { GameVenueComponent } from '../venue/game-venue.component';
import { SpielLinkComponent } from './spiel-link.component';
import type { SpielZeile } from './spiel-zeile';

/**
 * A Team's next Spiel, on the Team page and the overview alike: its line,
 * linking to its Spiel page, and its Halle with the way there, as the
 * screen's read of this Spiel's details gives it.
 */
@Component({
  selector: 'korb-naechstes-spiel',
  // on the scoreboard, wherever it shows (`.anzeigetafel` in styles.scss)
  host: { class: 'anzeigetafel' },
  imports: [GameVenueComponent, SpielLinkComponent],
  template: `
    <korb-spiel-link
      [titel]="titel()"
      [zeile]="zeile()"
      [mitLiga]="mitLiga()"
    />
    @if (halle(); as stand) {
      <korb-game-venue [state]="stand" />
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
  public readonly halle = input<VenueState>();
  /** Whether to name the Spiel's Liga. */
  public readonly mitLiga = input(false, { transform: booleanAttribute });
  /** The heading above it, e.g. naming the Team that plays it. */
  public readonly titel = input('Nächstes Spiel');
}
