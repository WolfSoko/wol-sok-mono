import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import type { FacettenSchritt } from './facetten-schritt';

/**
 * A step of the Team wizard: why its search failed, that it found
 * nothing, or a select of its choices, bound two-way to the pick.
 */
@Component({
  selector: 'korb-facetten-select',
  imports: [MatFormFieldModule, MatSelectModule],
  template: `
    @let facetten = schritt().facetten();
    @if (schritt().fehler(); as text) {
      <p class="fehler" role="alert">{{ text }}</p>
    } @else if (schritt().leer(); as text) {
      <p>{{ text }}</p>
    }
    @if (facetten.length > 0) {
      <mat-form-field appearance="outline">
        <mat-label>{{ label() }}</mat-label>
        <mat-select
          [attr.data-qa]="qa()"
          [value]="wert()"
          (valueChange)="wert.set($event)"
        >
          @for (facette of facetten; track facette.id) {
            <mat-option [value]="facette.id">{{ facette.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacettenSelectComponent<Id extends number | string> {
  public readonly label = input.required<string>();
  /** The select's `data-qa`, for specs and the e2e. */
  public readonly qa = input.required<string>();
  public readonly schritt = input.required<FacettenSchritt<Id>>();
  /** The pick; `undefined` while none is made. */
  public readonly wert = model<Id | undefined>();
}
