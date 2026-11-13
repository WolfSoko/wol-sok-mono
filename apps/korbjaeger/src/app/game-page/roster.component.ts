import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import type { Roster } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { ChildMarkComponent } from '../child/child-mark.component';
import { statsColumns } from './roster-columns';
import { rosterRows } from './roster-rows';

/**
 * One Team's Kader of a Spielbericht: each player as the DBB shows them
 * (shirt number, name), an Anonymer Spieler as such; the shirt numbers
 * only where the Kader lists any. The Spielerwerte
 * columns appear only where the Verband records them (`statsColumns`),
 * the starting five only where the DBB names it; a Kader without
 * Spielerwerte says so instead of showing zeros. On a narrow phone the
 * table scrolls sideways, number and name staying in place. In a followed Team's Kader (`followed`)
 * each named player can be marked as the Elternteil's Kind, and a marked
 * Kind is highlighted: a star and its Spitzname, not colour alone.
 */
@Component({
  selector: 'korb-roster',
  imports: [ChildMarkComponent, MatIconModule, MatTableModule],
  templateUrl: './roster.component.html',
  styleUrl: './roster.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosterComponent {
  /** The Team's name, or its side while the Spiel cannot be read. */
  public readonly heading = input.required<string>();
  public readonly roster = input.required<Roster>();
  /** Unique on the page, to name the table by its heading. */
  public readonly side = input.required<string>();
  /** Whether the Team is one of Meine Teams, so its Kinder can be marked. */
  public readonly followed = input(false);

  private readonly children = inject(AUSWAHL).children;

  protected readonly rows = computed(() => {
    const children = this.children();
    return rosterRows(
      this.roster(),
      this.followed() && children !== undefined ? children : undefined
    );
  });
  protected readonly statsColumns = computed(() => statsColumns(this.roster()));
  protected readonly columns = computed(() => [
    ...(this.rows().some((row) => row.number !== undefined) ? ['number'] : []),
    'name',
    ...this.statsColumns().map((column) => column.id),
  ]);
  protected readonly headingId = computed(() => `roster-${this.side()}`);
}
