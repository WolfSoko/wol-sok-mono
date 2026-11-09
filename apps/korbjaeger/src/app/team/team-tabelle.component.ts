import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import type { Liga, TeamId } from '@wolsok/feat-shared-basketball-data';
import { tabelleResource } from '../basketball-data/tabelle-resource';
import { fehlerText } from '../fehler/fehler-text';
import { StandComponent } from '../stand/stand.component';
import { tabelleZeilen } from './tabelle-zeilen';

/** What the page says for a Liga the DBB does not know. */
const KEINE_TABELLE = 'Diese Tabelle kennt der DBB nicht.';

/** The columns, in the order the Tabelle shows them. */
const SPALTEN = [
  'rang',
  'team',
  'spiele',
  'siege',
  'niederlagen',
  'koerbe',
  'differenz',
] as const;

/**
 * One Liga's Tabelle on the Team page, the Team's own line highlighted. It
 * reads, loads and fails on its own, so a Tabelle the DBB cannot give hides
 * neither the Spiele nor the other Tabellen.
 */
@Component({
  selector: 'korb-team-tabelle',
  imports: [MatProgressBarModule, MatTableModule, StandComponent],
  templateUrl: './team-tabelle.component.html',
  styleUrl: './team-tabelle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamTabelleComponent {
  public readonly liga = input.required<Liga>();
  /** The Team whose page it is. */
  public readonly teamId = input.required<TeamId>();

  protected readonly spalten = SPALTEN;
  protected readonly ueberschriftId = computed(
    () => `tabelle-${this.liga().id}`
  );

  protected readonly tabelle = tabelleResource(() => this.liga().id);

  protected readonly zeilen = computed(() =>
    this.tabelle.hasValue()
      ? tabelleZeilen(this.tabelle.value(), this.teamId())
      : []
  );

  protected readonly fehler = computed(() =>
    fehlerText(this.tabelle.error(), KEINE_TABELLE)
  );
}
