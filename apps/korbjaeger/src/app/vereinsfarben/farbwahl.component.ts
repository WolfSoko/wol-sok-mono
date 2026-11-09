import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { VORGABEN } from './vorgaben';

/** What the colour picker shows before any colour is chosen. */
const OHNE_WAHL = '#000000';

/**
 * Picks one colour: one of the presets (`VORGABEN`, each named for screen
 * readers), an own one from the browser's colour picker, or, with
 * `mitKeiner`, none.
 */
@Component({
  selector: 'korb-farbwahl',
  imports: [MatButtonToggleModule],
  template: `
    <fieldset>
      <legend>{{ legende() }}</legend>
      <mat-button-toggle-group
        hideSingleSelectionIndicator
        [value]="farbe() ?? null"
        [attr.aria-label]="legende()"
        (change)="farbe.set($event.value ?? undefined)"
      >
        @if (mitKeiner()) {
          <mat-button-toggle [value]="null">Keine</mat-button-toggle>
        }
        @for (vorgabe of vorgaben; track vorgabe.farbe) {
          <mat-button-toggle
            [value]="vorgabe.farbe"
            [aria-label]="vorgabe.name"
          >
            <span class="probe" [style.background-color]="vorgabe.farbe"></span>
          </mat-button-toggle>
        }
      </mat-button-toggle-group>
      <label class="eigene">
        <input
          type="color"
          [value]="farbe() ?? ohneWahl"
          (input)="farbe.set(eingabe($event))"
        />
        Eigene Farbe
      </label>
    </fieldset>
  `,
  styles: `
    fieldset {
      border: none;
      margin: 0;
      padding: 0;
    }
    legend {
      font: var(--mat-sys-title-small);
      font-weight: var(--mat-sys-title-small-weight);
      margin-block-end: 0.5rem;
    }
    mat-button-toggle-group {
      flex-wrap: wrap;
      /* the rows wrap: a pill would cut them off at its round ends */
      --mat-button-toggle-shape: var(--mat-sys-corner-medium);
    }
    .probe {
      display: inline-block;
      inline-size: 1.5rem;
      block-size: 1.5rem;
      border-radius: 50%;
      vertical-align: middle;
      border: 1px solid var(--mat-sys-outline);
    }
    .eigene {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-block-start: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FarbwahlComponent {
  public readonly legende = input.required<string>();
  public readonly mitKeiner = input(false, { transform: booleanAttribute });
  /** The colour chosen, `#rrggbb`; `undefined` for none. */
  public readonly farbe = model<string | undefined>();

  protected readonly vorgaben = VORGABEN;
  protected readonly ohneWahl = OHNE_WAHL;

  protected eingabe(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
