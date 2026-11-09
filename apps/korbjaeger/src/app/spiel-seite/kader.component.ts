import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import type { Kader } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { KindMarkierungComponent } from '../kind/kind-markierung.component';
import { kaderZeilen } from './kader-zeilen';

/** The columns of a Kader whose Spielerwerte the Verband records. */
const WERTE_SPALTEN = ['punkte', 'feldkoerbe', 'freiwuerfe', 'fouls'] as const;

/**
 * One Team's Kader of a Spielbericht: each player as the DBB shows them
 * (shirt number, name), an Anonymer Spieler as such; the shirt numbers
 * only where the Kader lists any. The Spielerwerte
 * columns appear only where the Verband records them; a Kader without
 * says so instead of showing zeros. In a followed Team's Kader (`gefolgt`)
 * each named player can be marked as the Elternteil's Kind, and a marked
 * Kind is highlighted: a star and its Spitzname, not colour alone.
 */
@Component({
  selector: 'korb-kader',
  imports: [KindMarkierungComponent, MatIconModule, MatTableModule],
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
  /** Whether the Team is one of Meine Teams, so its Kinder can be marked. */
  public readonly gefolgt = input(false);

  private readonly kinder = inject(AUSWAHL).kinder;

  protected readonly zeilen = computed(() => {
    const kinder = this.kinder();
    return kaderZeilen(
      this.kader(),
      this.gefolgt() && kinder !== undefined ? kinder : undefined
    );
  });
  protected readonly spalten = computed(() => [
    ...(this.zeilen().some((zeile) => zeile.nummer !== undefined)
      ? ['nummer']
      : []),
    'name',
    ...(this.kader().spielerwerteErfasst ? WERTE_SPALTEN : []),
  ]);
  protected readonly ueberschriftId = computed(() => `kader-${this.seite()}`);
}
