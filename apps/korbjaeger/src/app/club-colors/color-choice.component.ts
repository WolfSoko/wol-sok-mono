import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { PRESETS } from './presets';

/** What the colour picker shows before any colour is chosen. */
const NO_CHOICE = '#000000';

/**
 * Picks one colour: one of the presets (`PRESETS`, each named for screen
 * readers), an own one from the browser's colour picker (taken once the
 * picker closes, not on every step of a drag), or, with `withNone`, none.
 */
@Component({
  selector: 'korb-color-choice',
  imports: [MatButtonToggleModule],
  template: `
    <fieldset>
      <legend>{{ legend() }}</legend>
      <mat-button-toggle-group
        hideSingleSelectionIndicator
        [value]="color() ?? null"
        [attr.aria-label]="legend()"
        (change)="color.set($event.value ?? undefined)"
      >
        @if (withNone()) {
          <mat-button-toggle [value]="null">Keine</mat-button-toggle>
        }
        @for (preset of presets; track preset.color) {
          <mat-button-toggle [value]="preset.color" [aria-label]="preset.name">
            <span class="swatch" [style.background-color]="preset.color"></span>
          </mat-button-toggle>
        }
      </mat-button-toggle-group>
      <label class="own">
        <input
          type="color"
          [value]="color() ?? noChoice"
          (change)="color.set(input($event))"
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
    .swatch {
      display: inline-block;
      inline-size: 1.5rem;
      block-size: 1.5rem;
      border-radius: 50%;
      vertical-align: middle;
      border: 1px solid var(--mat-sys-outline);
    }
    .own {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-block-start: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorChoiceComponent {
  public readonly legend = input.required<string>();
  public readonly withNone = input(false, { transform: booleanAttribute });
  /** The colour chosen, `#rrggbb`; `undefined` for none. */
  public readonly color = model<string | undefined>();

  protected readonly presets = PRESETS;
  protected readonly noChoice = NO_CHOICE;

  protected input(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
