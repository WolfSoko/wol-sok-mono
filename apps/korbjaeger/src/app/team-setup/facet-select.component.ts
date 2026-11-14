import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import type { FacetStep } from './facet-step';

/**
 * A step of the Team wizard: why its search failed, that it found
 * nothing, or a select of its choices, bound two-way to the pick.
 */
@Component({
  selector: 'korb-facet-select',
  imports: [MatFormFieldModule, MatSelectModule],
  template: `
    @let facets = step().facets();
    @if (step().error(); as text) {
      <p class="error" role="alert">{{ text }}</p>
    } @else if (step().empty(); as text) {
      <p>{{ text }}</p>
    }
    @if (facets.length > 0) {
      <mat-form-field appearance="outline">
        <mat-label>{{ label() }}</mat-label>
        <mat-select
          [attr.data-qa]="qa()"
          [value]="value()"
          (valueChange)="value.set($event)"
        >
          @for (facet of facets; track facet.id) {
            <mat-option [value]="facet.id">{{ facet.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacetSelectComponent<Id extends number | string> {
  public readonly label = input.required<string>();
  /** The select's `data-qa`, for specs and the e2e. */
  public readonly qa = input.required<string>();
  public readonly step = input.required<FacetStep<Id>>();
  /** The pick; `undefined` while none is made. */
  public readonly value = model<Id | undefined>();
}
