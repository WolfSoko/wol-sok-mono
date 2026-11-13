import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  venueAddress,
  venueNavigationUrl,
  type Venue,
} from '@wolsok/feat-shared-basketball-data';

/**
 * Where a Spiel is played: the Halle's name and address, with a link that
 * opens navigation (the maps app on a phone) in a tab of its own; or that
 * the DBB names none yet.
 */
@Component({
  selector: 'korb-venue',
  imports: [MatButtonModule, MatIconModule],
  host: { 'data-qa': 'venue' },
  template: `
    @if (venue(); as shown) {
      <span class="name" data-qa="venue-name">{{ shown.name }}</span>
      @if (address()) {
        <span class="address" data-qa="venue-address">{{ address() }}</span>
      }
      <a
        matButton="tonal"
        class="navigation"
        data-qa="venue-navigation"
        target="_blank"
        rel="noopener"
        [href]="navigationUrl()"
      >
        <mat-icon aria-hidden="true">directions</mat-icon>
        Route planen
        <span class="cdk-visually-hidden">
          zur Halle {{ shown.name }} (öffnet neuen Tab)</span
        >
      </a>
    } @else {
      <span class="pending">Die Halle steht noch nicht fest.</span>
    }
  `,
  styles: `
    :host {
      display: grid;
      justify-items: start;
      gap: 0.25rem;
    }
    .name {
      font: var(--mat-sys-body-large);
    }
    .address,
    .pending {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .navigation {
      margin-block-start: 0.25rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VenueComponent {
  /** `undefined` while the DBB names no Halle. */
  public readonly venue = input.required<Venue | undefined>();

  protected readonly address = computed(() => {
    const venue = this.venue();
    return venue && venueAddress(venue);
  });

  protected readonly navigationUrl = computed(() => {
    const venue = this.venue();
    return venue && venueNavigationUrl(venue);
  });
}
