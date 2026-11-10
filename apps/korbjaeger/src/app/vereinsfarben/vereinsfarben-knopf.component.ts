import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { Verein } from '@wolsok/feat-shared-basketball-data';

/**
 * The button "Vereinsfarben" (named "Vereinsfarben von …" for screen
 * readers, as several cards may offer one): opens the bottom sheet for
 * `verein`, its code loaded on the first tap, not with the screen. The one
 * control every screen offering a Verein's colours uses.
 */
@Component({
  selector: 'korb-vereinsfarben-knopf',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <button
      matButton
      type="button"
      data-qa="vereinsfarben"
      [attr.aria-label]="'Vereinsfarben von ' + verein().name"
      (click)="oeffnen()"
    >
      <mat-icon aria-hidden="true">palette</mat-icon>
      Vereinsfarben
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VereinsfarbenKnopfComponent {
  public readonly verein = input.required<Verein>();

  private readonly blatt = inject(MatBottomSheet);

  protected async oeffnen(): Promise<void> {
    const { VereinsfarbenBlattComponent } =
      await import('./vereinsfarben-blatt.component');
    const { id, name } = this.verein();
    this.blatt.open(VereinsfarbenBlattComponent, {
      data: { vereinId: id, vereinName: name },
      ariaLabel: `Vereinsfarben von ${name}`,
    });
  }
}
