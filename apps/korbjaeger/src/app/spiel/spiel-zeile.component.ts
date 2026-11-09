import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import type { SpielAusgang } from '@wolsok/feat-shared-basketball-data';
import type { SpielZeile } from './spiel-zeile';

/**
 * One Spiel as a line, on the Team page and the overview alike: home or
 * away and the opponent, day and time, the Liga where asked, and the
 * result and whether it was cancelled or forfeited.
 */
@Component({
  selector: 'korb-spiel-zeile',
  imports: [MatChipsModule],
  template: `
    @let spiel = zeile();
    @if (titel(); as text) {
      <span class="titel">{{ text }}</span>
    }
    <span class="wer">
      @if (spiel.ort) {
        <span data-qa="spiel-ort">{{ spiel.ort }}</span> gegen
      }
      <span data-qa="spiel-gegner">{{ spiel.gegner }}</span>
    </span>
    <span class="wann">
      <span data-qa="spiel-datum">{{ spiel.datum }}</span>
      @if (spiel.uhrzeit) {
        · <span data-qa="spiel-uhrzeit">{{ spiel.uhrzeit }}</span> Uhr
      }
    </span>
    @if (mitLiga()) {
      <span class="liga" data-qa="spiel-liga">{{ spiel.liga }}</span>
    }
    @if (spiel.ergebnis || spiel.ausgang || spiel.markierung) {
      <span class="ausgang">
        @if (spiel.ausgang; as ausgang) {
          <span
            class="ausgang-marke"
            [class]="ausgang"
            data-qa="spiel-ausgang"
            >{{ ausgangText[ausgang] }}</span
          >
        }
        @if (spiel.ergebnis) {
          <span class="ergebnis" data-qa="spiel-ergebnis">{{
            spiel.ergebnis
          }}</span>
        }
        @if (spiel.markierung) {
          <mat-chip class="markierung" data-qa="spiel-markierung">{{
            spiel.markierung
          }}</mat-chip>
        }
      </span>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: 1fr auto;
      column-gap: 1rem;
      align-items: start;
    }
    .titel,
    .wer,
    .wann,
    .liga {
      grid-column: 1;
    }
    .titel {
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
    }
    .wer {
      font: var(--mat-sys-body-large);
    }
    .wann,
    .liga {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .ausgang {
      grid-column: 2;
      grid-row: 1 / span 4;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
    }
    .ergebnis {
      font: var(--mat-sys-title-large);
      font-variant-numeric: tabular-nums;
    }
    .ausgang-marke {
      padding: 0.125rem 0.5rem;
      border-radius: var(--korb-marke-rundung);
      font: var(--mat-sys-label-large);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .sieg {
      background: var(--korb-sieg-container);
      color: var(--korb-sieg-on-container);
    }
    .niederlage {
      background: var(--korb-niederlage-container);
      color: var(--korb-niederlage-on-container);
    }
    .markierung {
      --mat-chip-elevated-container-color: var(--mat-sys-error-container);
      --mat-chip-label-text-color: var(--mat-sys-on-error-container);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpielZeileComponent {
  public readonly zeile = input.required<SpielZeile>();
  /** A heading above the line, e.g. "Nächstes Spiel". */
  public readonly titel = input<string>();
  /** Whether to name the Spiel's Liga. */
  public readonly mitLiga = input(false, { transform: booleanAttribute });

  /** How a result reads: in words, never by colour alone. */
  protected readonly ausgangText: Record<SpielAusgang, string> = {
    sieg: 'Sieg',
    niederlage: 'Niederlage',
  };
}
