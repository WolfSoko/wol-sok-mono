import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import type { League, TeamId } from '@wolsok/feat-shared-basketball-data';
import { standingsResource } from '../basketball-data/standings-resource';
import { errorText } from '../errors/error-text';
import { AsOfComponent } from '../as-of/as-of.component';
import { standingsRows } from './standings-rows';

/** What the page says for a Liga the DBB does not know. */
const NO_STANDINGS = 'Diese Tabelle kennt der DBB nicht.';

/** The columns, in the order the Tabelle shows them. */
const COLUMNS = [
  'rank',
  'team',
  'games',
  'wins',
  'losses',
  'points',
  'difference',
] as const;

/**
 * One Liga's Tabelle on the Team page, the Team's own line highlighted. It
 * reads, loads and fails on its own, so a Tabelle the DBB cannot give hides
 * neither the Spiele nor the other Tabellen.
 */
@Component({
  selector: 'korb-team-standings',
  imports: [MatProgressBarModule, MatTableModule, AsOfComponent],
  templateUrl: './team-standings.component.html',
  styleUrl: './team-standings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamStandingsComponent {
  public readonly league = input.required<League>();
  /** The Team whose page it is. */
  public readonly teamId = input.required<TeamId>();

  protected readonly columns = COLUMNS;
  protected readonly headingId = computed(() => `tabelle-${this.league().id}`);

  protected readonly standings = standingsResource(() => this.league().id);

  protected readonly rows = computed(() =>
    this.standings.hasValue()
      ? standingsRows(this.standings.value(), this.teamId())
      : []
  );

  protected readonly error = computed(() =>
    errorText(this.standings.error(), NO_STANDINGS)
  );
}
