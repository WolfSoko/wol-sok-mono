import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { VenueComponent } from './venue.component';
import type { VenueState } from './venue-state';

/**
 * A Spiel's Halle as its read stands (`state`): loading, why it failed, or
 * the Halle. Reads nothing itself; the screen holding the read passes it.
 */
@Component({
  selector: 'korb-game-venue',
  imports: [VenueComponent, MatProgressBarModule],
  template: `
    @let venueState = state();
    @switch (venueState.kind) {
      @case ('loading') {
        <mat-progress-bar
          mode="indeterminate"
          aria-label="Halle wird geladen"
        />
      }
      @case ('error') {
        <p class="fehler" data-qa="venue-error">{{ venueState.text }}</p>
      }
      @case ('read') {
        <korb-venue [venue]="venueState.venue" />
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
export class GameVenueComponent {
  public readonly state = input.required<VenueState>();
}
