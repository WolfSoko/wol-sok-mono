import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import type { SpielZeile } from '../team/team-spiele';

/** One Spiel of a Team on the overview, under a heading (`titel`). */
@Component({
  selector: 'korb-ueberblick-spiel',
  imports: [MatChipsModule],
  template: `
    @let spiel = zeile();
    <span class="titel">{{ titel() }}</span>
    <span class="wann">
      {{ spiel.datum }}
      @if (spiel.uhrzeit) {
        · {{ spiel.uhrzeit }} Uhr
      }
    </span>
    <span class="wer">
      @if (spiel.ort) {
        {{ spiel.ort }} gegen
      }
      {{ spiel.gegner }}
    </span>
    @if (spiel.ergebnis || spiel.markierung) {
      <span class="ausgang">
        @if (spiel.ergebnis) {
          <span class="ergebnis">{{ spiel.ergebnis }}</span>
        }
        @if (spiel.markierung) {
          <mat-chip class="markierung">{{ spiel.markierung }}</mat-chip>
        }
      </span>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: 1fr auto;
      column-gap: 1rem;
    }
    .titel {
      grid-column: 1 / -1;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
    }
    .wann,
    .wer {
      grid-column: 1;
    }
    .ausgang {
      grid-column: 2;
      grid-row: 2 / span 2;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
    }
    .ergebnis {
      font: var(--mat-sys-title-medium);
      font-variant-numeric: tabular-nums;
    }
    .markierung {
      --mat-chip-elevated-container-color: var(--mat-sys-error-container);
      --mat-chip-label-text-color: var(--mat-sys-on-error-container);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeberblickSpielComponent {
  public readonly titel = input.required<string>();
  public readonly zeile = input.required<SpielZeile>();
}
