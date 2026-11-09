import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  halleAdresse,
  halleNavigationUrl,
  type Halle,
} from '@wolsok/feat-shared-basketball-data';

/**
 * Where a Spiel is played: the Halle's name and address, with a link that
 * opens navigation (the maps app on a phone) in a tab of its own; or that
 * the DBB names none yet.
 */
@Component({
  selector: 'korb-halle',
  imports: [MatButtonModule, MatIconModule],
  host: { 'data-qa': 'halle' },
  template: `
    @if (halle(); as ort) {
      <span class="name" data-qa="halle-name">{{ ort.name }}</span>
      @if (adresse()) {
        <span class="adresse" data-qa="halle-adresse">{{ adresse() }}</span>
      }
      <a
        matButton="tonal"
        class="navigation"
        data-qa="halle-navigation"
        target="_blank"
        rel="noopener"
        [href]="navigationUrl()"
      >
        <mat-icon aria-hidden="true">directions</mat-icon>
        Route planen
        <span class="cdk-visually-hidden">
          zur Halle {{ ort.name }} (öffnet neuen Tab)</span
        >
      </a>
    } @else {
      <span class="offen">Die Halle steht noch nicht fest.</span>
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
    .adresse,
    .offen {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .navigation {
      margin-block-start: 0.25rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HalleComponent {
  /** `undefined` while the DBB names no Halle. */
  public readonly halle = input.required<Halle | undefined>();

  protected readonly adresse = computed(() => {
    const halle = this.halle();
    return halle && halleAdresse(halle);
  });

  protected readonly navigationUrl = computed(() => {
    const halle = this.halle();
    return halle && halleNavigationUrl(halle);
  });
}
