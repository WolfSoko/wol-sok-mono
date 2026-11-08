import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type {
  Liga,
  LigaSucheFilter,
} from '@wolsok/feat-shared-basketball-data';
import { fehlerText, KEINE_LIGEN } from '../fehler/fehler-text';
import { ligaBeschreibung } from './liga-beschreibung';
import { ligenSeiten } from './ligen-seiten';

/** The Ligen of a filter, page by page, to pick one of. */
@Component({
  selector: 'korb-liga-wahl',
  imports: [MatButtonModule, MatListModule, MatProgressBarModule],
  template: `
    @if (ligen.ligen().length > 0) {
      <mat-action-list class="ligen">
        @for (liga of ligen.ligen(); track liga.id) {
          <button
            mat-list-item
            type="button"
            data-qa="liga"
            (click)="gewaehlt.emit(liga)"
          >
            <span matListItemTitle>{{ liga.name }}</span>
            <span matListItemLine>{{ beschreibung(liga) }}</span>
          </button>
        }
      </mat-action-list>
    }
    @if (ligen.laedt()) {
      <mat-progress-bar
        mode="indeterminate"
        aria-label="Ligen werden geladen"
      />
    } @else if (ligen.weitere()) {
      <button matButton="outlined" type="button" (click)="ligen.mehr()">
        Weitere Ligen
      </button>
    }
    @if (fehler(); as text) {
      <p class="fehler" role="alert">{{ text }}</p>
    }
  `,
  styles: `
    // Liga names are long: let them wrap rather than cut them off.
    .ligen .mat-mdc-list-item {
      height: auto;
      padding-block: 0.5rem;

      [matListItemTitle] {
        overflow: visible;
        white-space: normal;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LigaWahlComponent {
  /** The Verband, age group and gender to list the Ligen of. */
  public readonly filter = input.required<LigaSucheFilter>();
  /** The Liga tapped. */
  public readonly gewaehlt = output<Liga>();

  protected readonly ligen = ligenSeiten(() => this.filter());
  protected readonly beschreibung = ligaBeschreibung;

  protected readonly fehler = computed(() =>
    fehlerText(this.ligen.fehler(), KEINE_LIGEN)
  );
}
