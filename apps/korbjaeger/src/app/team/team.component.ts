import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AUSWAHL } from '../auswahl/auswahl';
import { teamSaisonResource } from '../basketball-data/team-saison-resource';
import { HEUTE } from '../heute';
import { RouterLink } from '@angular/router';
import {
  ligenAktuellZuerst,
  naechstesSpiel,
  parseDbbId,
} from '@wolsok/feat-shared-basketball-data';
import { NaechstesSpielComponent } from '../spiel/naechstes-spiel.component';
import { SpielZeileComponent } from '../spiel/spiel-zeile.component';
import { spielZeile, spielZeilen } from '../spiel/spiel-zeile';
import { fehlerText, KEIN_TEAM } from '../fehler/fehler-text';
import { TeamFolgenComponent } from './team-folgen.component';
import { TeamTabelleComponent } from './team-tabelle.component';

/**
 * The Team page: its next Spiel with its Halle, its Spiele of the Saison
 * (each opening its Spiel page), across all its Ligen, by date, then the
 * Tabelle of each of those Ligen, the current one first; with a control
 * to follow the Team.
 */
@Component({
  selector: 'korb-team',
  imports: [
    MatListModule,
    MatProgressBarModule,
    NaechstesSpielComponent,
    RouterLink,
    SpielZeileComponent,
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

  private readonly heute = inject(HEUTE);
  private readonly meineTeams = inject(AUSWAHL).teams;
  private readonly team = computed(() => parseDbbId(this.teamId()));

  protected readonly saison = teamSaisonResource(() => this.team());

  /**
   * The Team to offer following: one the DBB knows, or one of Meine Teams
   * whatever its read gave (a Saison may have ended for it).
   */
  protected readonly folgbar = computed(() => {
    const team = this.team();
    return team !== undefined &&
      (this.saison.hasValue() || this.meineTeams()?.includes(team))
      ? team
      : undefined;
  });

  protected readonly zeilen = computed(() =>
    this.saison.hasValue() ? spielZeilen(this.saison.value()) : []
  );

  /** The next Spiel to go to, from today on. */
  protected readonly naechstes = computed(() => {
    if (!this.saison.hasValue()) {
      return undefined;
    }
    const saison = this.saison.value();
    const spiel = naechstesSpiel(saison, this.heute());
    return spiel && spielZeile(saison, spiel);
  });

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
