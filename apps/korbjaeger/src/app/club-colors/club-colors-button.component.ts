import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { Club } from '@wolsok/feat-shared-basketball-data';

/**
 * The button "Vereinsfarben" (named "Vereinsfarben von …" for screen
 * readers, as several cards may offer one): opens the bottom sheet for
 * `club`, its code loaded on the first tap, not with the screen. The one
 * control every screen offering a Verein's colours uses.
 */
@Component({
  selector: 'korb-club-colors-button',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <button
      matButton
      type="button"
      data-qa="club-colors"
      [attr.aria-label]="'Vereinsfarben von ' + club().name"
      (click)="open()"
    >
      <mat-icon aria-hidden="true">palette</mat-icon>
      Vereinsfarben
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClubColorsButtonComponent {
  public readonly club = input.required<Club>();

  private readonly sheet = inject(MatBottomSheet);

  protected async open(): Promise<void> {
    const { ClubColorsSheetComponent } =
      await import('./club-colors-sheet.component');
    const { id, name } = this.club();
    this.sheet.open(ClubColorsSheetComponent, {
      data: { clubId: id, clubName: name },
      ariaLabel: `Vereinsfarben von ${name}`,
    });
  }
}
