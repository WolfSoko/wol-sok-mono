import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import type { Kader } from '@wolsok/feat-shared-basketball-data';
import { kaderZeilen } from './kader-zeilen';

/** The columns of every Kader. */
const NAME_SPALTEN = ['nummer', 'name'] as const;

/** The columns of a Kader whose Spielerwerte the Verband records. */
const WERTE_SPALTEN = [
  ...NAME_SPALTEN,
  'punkte',
  'feldkoerbe',
  'freiwuerfe',
  'fouls',
] as const;

/**
 * One Team's Kader of a Spielbericht: each player as the DBB shows them
 * (shirt number, name), an Anonymer Spieler as such. The Spielerwerte
 * columns appear only where the Verband records them; a Kader without
 * says so instead of showing zeros.
 */
@Component({
  selector: 'korb-kader',
  imports: [MatTableModule],
  templateUrl: './kader.component.html',
  styleUrl: './kader.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KaderComponent {
  /** The Team's name, or its side while the Spiel cannot be read. */
  public readonly titel = input.required<string>();
  public readonly kader = input.required<Kader>();
  /** Unique on the page, to name the table by its heading. */
  public readonly seite = input.required<string>();

  protected readonly zeilen = computed(() => kaderZeilen(this.kader()));
  protected readonly spalten = computed(() =>
    this.kader().spielerwerteErfasst ? WERTE_SPALTEN : NAME_SPALTEN
  );
  protected readonly ueberschriftId = computed(() => `kader-${this.seite()}`);
}
