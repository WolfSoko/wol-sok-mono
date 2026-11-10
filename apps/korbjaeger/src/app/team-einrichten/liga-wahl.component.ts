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
import type { League } from '@wolsok/feat-shared-basketball-data';
import { fehlerText, KEINE_LIGEN } from '../fehler/fehler-text';
import { ligaBeschreibung } from './liga-beschreibung';
import type { LigenSeiten } from './ligen-seiten';

/**
 * The Ligen of a filter, page by page, to pick one of. Shows the pages it
 * is given (`ligenSeiten`), which outlive it: back from a picked Liga,
 * the pages read are still there.
 */
@Component({
  selector: 'korb-liga-wahl',
  imports: [MatButtonModule, MatListModule, MatProgressBarModule],
  template: `
    @let ligen = seiten();
    @if (ligen.ligen().length > 0) {
      <mat-action-list class="umbrechende-liste">
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LigaWahlComponent {
  /** The Ligen of the Verband, age group and gender picked. */
  public readonly seiten = input.required<LigenSeiten>();
  /** The Liga tapped. */
  public readonly gewaehlt = output<League>();

  protected readonly beschreibung = ligaBeschreibung;

  protected readonly fehler = computed(() =>
    fehlerText(this.seiten().fehler(), KEINE_LIGEN)
  );
}
