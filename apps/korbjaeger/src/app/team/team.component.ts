import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AUSWAHL } from '../auswahl/auswahl';
import { spielDetailsResource } from '../basketball-data/spiel-details-resource';
import { teamSaisonResource } from '../basketball-data/team-saison-resource';
import { vereinsTeamsResource } from '../basketball-data/vereins-teams-resource';
import { hallenStand } from '../halle/hallen-stand';
import { HEUTE } from '../heute';
import { RouterLink } from '@angular/router';
import {
  ligenAktuellZuerst,
  naechstesSpiel,
  parseDbbId,
  saisonBeendet,
  type TeamSaison,
  type VereinId,
} from '@wolsok/feat-shared-basketball-data';
import { NaechstesSpielComponent } from '../spiel/naechstes-spiel.component';
import { SpielZeileComponent } from '../spiel/spiel-zeile.component';
import { spielZeile, spielZeilen } from '../spiel/spiel-zeile';
import { fehlerText, KEIN_TEAM } from '../fehler/fehler-text';
import { TeamFolgenComponent } from './team-folgen.component';
import { vereinsTeamsStand } from '../verein/vereins-teams-stand';
import { SaisonEndeHinweisComponent } from '../verein/saison-ende-hinweis.component';
import { VereinsTeamsComponent } from '../verein/vereins-teams.component';
import { aeltesterStand } from '../basketball-data/stand';
import { StandComponent } from '../stand/stand.component';
import { TeamTabelleComponent } from './team-tabelle.component';

/**
 * The Team page: its next Spiel with its Halle, its Spiele of the Saison
 * (each opening its Spiel page), across all its Ligen, by date, then the
 * Tabelle of each of those Ligen, the current one first, and the
 * Verein's other Teams; with a control to follow the Team and each of
 * those. Once the Team's Saison looks over (`saisonBeendet`), a hint asks
 * whether it is and offers the Verein's Teams first.
 */
@Component({
  selector: 'korb-team',
  imports: [
    MatListModule,
    MatProgressBarModule,
    NaechstesSpielComponent,
    RouterLink,
    SaisonEndeHinweisComponent,
    SpielZeileComponent,
    StandComponent,
    TeamFolgenComponent,
    TeamTabelleComponent,
    VereinsTeamsComponent,
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
  private readonly kommendesSpiel = computed(() =>
    this.saison.hasValue()
      ? naechstesSpiel(this.saison.value(), this.heute())
      : undefined
  );

  protected readonly naechstes = computed(() => {
    const spiel = this.kommendesSpiel();
    return spiel && this.saison.hasValue()
      ? spielZeile(this.saison.value(), spiel)
      : undefined;
  });

  /** The next Spiel's details, for its Halle: that Spiel's only. */
  private readonly naechsteDetails = spielDetailsResource(
    () => this.kommendesSpiel()?.id
  );

  protected readonly naechsteHalle = computed(() =>
    hallenStand(this.naechsteDetails)
  );

  protected readonly ligen = computed(() =>
    this.saison.hasValue()
      ? ligenAktuellZuerst(this.saison.value(), this.heute())
      : []
  );

  /** Whether the Team's Saison looks over, as of today. */
  protected readonly beendet = computed(
    () =>
      this.saison.hasValue() && saisonBeendet(this.saison.value(), this.heute())
  );

  /**
   * The Team's Verein, kept while the next Team loads, so a sibling Team of
   * the same Verein reads it no second time.
   */
  private readonly vereinId = linkedSignal<
    TeamSaison | undefined,
    VereinId | undefined
  >({
    source: () => (this.saison.hasValue() ? this.saison.value() : undefined),
    computation: (saison, vorher) => saison?.verein.id ?? vorher?.value,
  });

  protected readonly vereinsTeams = vereinsTeamsResource(() => this.vereinId());

  /** The Verein's Teams other than this one, as their read stands. */
  protected readonly weitereTeams = computed(() => {
    const team = this.team();
    return team === undefined
      ? undefined
      : vereinsTeamsStand(this.vereinsTeams, team);
  });

  /**
   * The oldest Stand of what the head shows: the Spiele, the next Spiel's
   * Halle, and the Verein's Teams while the hint offers them up there.
   */
  protected readonly kopfStand = computed(() =>
    aeltesterStand(
      this.saison.stand(),
      this.naechsteDetails.stand(),
      this.beendet() ? this.vereinsTeams.stand() : undefined
    )
  );

  protected readonly fehler = computed(() => {
    if (this.team() === undefined) {
      return KEIN_TEAM;
    }
    return fehlerText(this.saison.error(), KEIN_TEAM);
  });
}
