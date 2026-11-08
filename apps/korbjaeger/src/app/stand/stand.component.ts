import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { Stand } from '../basketball-data/stand';
import { JETZT } from '../jetzt';
import { standAlter, standGrundText, standZeit } from './stand-text';

/**
 * Where a screen shows a read's last good data (`stand`, from the read's
 * resource): why, and how old it is ("Offline · Stand: vor 2 Std."),
 * aging with `JETZT`. Nothing for data just read.
 */
@Component({
  selector: 'korb-stand',
  imports: [MatIconModule],
  template: `
    @if (anzeige(); as stand) {
      <p class="stand" data-qa="stand">
        <mat-icon aria-hidden="true">cloud_off</mat-icon>
        <span
          >{{ stand.grund }} ·
          <time [attr.datetime]="stand.iso" [title]="stand.zeit">{{
            stand.alter
          }}</time></span
        >
      </p>
    }
  `,
  styles: `
    .stand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0.5rem 0;
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StandComponent {
  /** The read's last good data it shows, `undefined` while it is fresh. */
  public readonly stand = input.required<Stand | undefined>();

  private readonly jetzt = inject(JETZT);

  protected readonly anzeige = computed(() => {
    const stand = this.stand();
    return stand === undefined
      ? undefined
      : {
          grund: standGrundText(stand.grund),
          alter: standAlter(stand.gespeichertAm, this.jetzt()),
          zeit: standZeit(stand.gespeichertAm),
          iso: new Date(stand.gespeichertAm).toISOString(),
        };
  });
}
