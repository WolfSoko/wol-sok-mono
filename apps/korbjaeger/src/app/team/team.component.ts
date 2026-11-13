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
import { gameDetailsResource } from '../basketball-data/game-details-resource';
import { teamSeasonResource } from '../basketball-data/team-season-resource';
import { clubTeamsResource } from '../basketball-data/club-teams-resource';
import { venueState } from '../venue/venue-state';
import { TODAY } from '../today';
import { RouterLink } from '@angular/router';
import {
  leaguesCurrentFirst,
  nextGame,
  parseDbbId,
  seasonOver,
  type TeamSeason,
  type ClubId,
} from '@wolsok/feat-shared-basketball-data';
import { NaechstesSpielComponent } from '../spiel/naechstes-spiel.component';
import { SpielZeileComponent } from '../spiel/spiel-zeile.component';
import { spielZeile, spielZeilen } from '../spiel/spiel-zeile';
import { errorText, NO_TEAM } from '../errors/error-text';
import { TeamFolgenComponent } from './team-folgen.component';
import { vereinsTeamsStand } from '../verein/vereins-teams-stand';
import { SaisonEndeHinweisComponent } from '../verein/saison-ende-hinweis.component';
import { VereinsTeamsComponent } from '../verein/vereins-teams.component';
import { oldestAsOf } from '../basketball-data/as-of';
import { AsOfComponent } from '../as-of/as-of.component';
import { TeamTabelleComponent } from './team-tabelle.component';
import { vereinsfarbenAnwenden } from '../vereinsfarben/vereinsfarben-anwenden';
import { breadcrumb } from '../navigation/breadcrumb';
import { VereinsfarbenKnopfComponent } from '../vereinsfarben/vereinsfarben-knopf.component';

/**
 * The Team page: its next Spiel with its Halle, its Spiele of the Saison
 * (each opening its Spiel page), across all its Ligen, by date, then the
 * Tabelle of each of those Ligen, the current one first, and the
 * Verein's other Teams; with a control to follow the Team and each of
 * those. Once the Team's Saison looks over (`seasonOver`), a hint asks
 * whether it is and offers the Verein's Teams first. The page wears the
 * colours an Elternteil gave the Verein ("Vereinsfarben", a bottom sheet).
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
    AsOfComponent,
    TeamFolgenComponent,
    TeamTabelleComponent,
    VereinsfarbenKnopfComponent,
    VereinsTeamsComponent,
  ],
  templateUrl: './team.component.html',
  styleUrl: './team.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamComponent {
  /** The Team's DBB id, as the route gives it. */
  public readonly teamId = input.required<string>();

  private readonly heute = inject(TODAY);
  private readonly meineTeams = inject(AUSWAHL).teams;
  private readonly team = computed(() => parseDbbId(this.teamId()));

  protected readonly saison = teamSeasonResource(() => this.team());

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
      ? nextGame(this.saison.value(), this.heute())
      : undefined
  );

  protected readonly naechstes = computed(() => {
    const spiel = this.kommendesSpiel();
    return spiel && this.saison.hasValue()
      ? spielZeile(this.saison.value(), spiel)
      : undefined;
  });

  /** The next Spiel's details, for its Halle: that Spiel's only. */
  private readonly naechsteDetails = gameDetailsResource(
    () => this.kommendesSpiel()?.id
  );

  protected readonly naechsteHalle = computed(() =>
    venueState(this.naechsteDetails)
  );

  protected readonly ligen = computed(() =>
    this.saison.hasValue()
      ? leaguesCurrentFirst(this.saison.value(), this.heute())
      : []
  );

  /** Whether the Team's Saison looks over, as of today. */
  protected readonly beendet = computed(
    () =>
      this.saison.hasValue() && seasonOver(this.saison.value(), this.heute())
  );

  /**
   * The Team's Verein, kept while the next Team loads, so a sibling Team of
   * the same Verein reads it no second time.
   */
  private readonly vereinId = linkedSignal<
    TeamSeason | undefined,
    ClubId | undefined
  >({
    source: () => (this.saison.hasValue() ? this.saison.value() : undefined),
    computation: (saison, vorher) => saison?.club.id ?? vorher?.value,
  });

  protected readonly vereinsTeams = clubTeamsResource(() => this.vereinId());

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
    oldestAsOf(
      this.saison.asOf(),
      this.naechsteDetails.asOf(),
      this.beendet() ? this.vereinsTeams.asOf() : undefined
    )
  );

  protected readonly fehler = computed(() => {
    if (this.team() === undefined) {
      return NO_TEAM;
    }
    return errorText(this.saison.error(), NO_TEAM);
  });

  public constructor() {
    // this Team's Verein only: `vereinId` keeps the last one while the next loads
    vereinsfarbenAnwenden(() =>
      this.saison.hasValue() ? this.saison.value().club.id : undefined
    );
    breadcrumb(() => [
      {
        title: this.saison.hasValue() ? this.saison.value().team.name : 'Team',
      },
    ]);
  }
}
