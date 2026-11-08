import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AUSWAHL } from '../auswahl/auswahl';
import { BASKETBALL_DATA } from '../basketball-data/basketball-data.provider';
import { HEUTE } from '../heute';
import {
  ligenAktuellZuerst,
  parseDbbId,
} from '@wolsok/feat-shared-basketball-data';
import { fehlerText } from './fehler-text';
import { TeamFolgenComponent } from './team-folgen.component';
import { KEIN_TEAM, spielZeilen } from './team-spiele';
import { TeamTabelleComponent } from './team-tabelle.component';

/**
 * The Team page: its Spiele of the Saison, across all its Ligen, by date,
 * then the Tabelle of each of those Ligen, the current one first; with a
 * control to follow the Team.
 */
@Component({
  selector: 'korb-team',
  imports: [
    MatChipsModule,
    MatListModule,
    MatProgressBarModule,
    TeamFolgenComponent,
    TeamTabelleComponent,
  ],
  templateUrl: './team.component.html',
  styleUrl: './team.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamComponent {
  /** The Team's DBB id, as the route gives it. */
  public readonly teamId = input.required<string>();

  private readonly data = inject(BASKETBALL_DATA);
  private readonly heute = inject(HEUTE);
  private readonly meineTeams = inject(AUSWAHL).teams;
  private readonly team = computed(() => parseDbbId(this.teamId()));

  protected readonly saison = resource({
    params: () => this.team(),
    loader: ({ params, abortSignal }) =>
      this.data.teamSpiele(params, { signal: abortSignal }),
  });

  /**
   * The Team to offer following: one the DBB knows, or one of Meine Teams
   * whatever its read gave (a Saison may have ended for it).
   */
  protected readonly folgbar = computed(() => {
    const team = this.team();
    if (team === undefined) {
      return undefined;
    }
    return this.saison.hasValue() || this.meineTeams().includes(team)
      ? team
      : undefined;
  });

  protected readonly zeilen = computed(() =>
    this.saison.hasValue() ? spielZeilen(this.saison.value()) : []
  );

  protected readonly ligen = computed(() =>
    this.saison.hasValue()
      ? ligenAktuellZuerst(this.saison.value(), this.heute())
      : []
  );

  protected readonly fehler = computed(() => {
    if (this.team() === undefined) {
      return KEIN_TEAM;
    }
    return fehlerText(this.saison.error(), KEIN_TEAM);
  });
}
