import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import type { VenueState } from '../venue/venue-state';
import { GameVenueComponent } from '../venue/game-venue.component';
import { GameLinkComponent } from './game-link.component';
import type { GameRow } from './game-row';

/**
 * A Team's next Spiel, on the Team page and the overview alike: its line,
 * linking to its Spiel page, and its Halle with the way there, as the
 * screen's read of this Spiel's details gives it.
 */
@Component({
  selector: 'korb-next-game',
  // on the scoreboard, wherever it shows (`.scoreboard` in styles.scss)
  host: { class: 'scoreboard' },
  imports: [GameVenueComponent, GameLinkComponent],
  template: `
    <korb-game-link
      [heading]="heading()"
      [row]="row()"
      [withLeague]="withLeague()"
    />
    @if (venue(); as stand) {
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
export class NextGameComponent {
  public readonly row = input.required<GameRow>();
  /** The read of its Halle; none before it started. */
  public readonly venue = input<VenueState>();
  /** Whether to name the Spiel's Liga. */
  public readonly withLeague = input(false, { transform: booleanAttribute });
  /** The heading above it, e.g. naming the Team that plays it. */
  public readonly heading = input('Nächstes Spiel');
}
