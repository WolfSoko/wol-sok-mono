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
import { SELECTION } from '../selection/selection';
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
import { NextGameComponent } from '../game/next-game.component';
import { GameRowComponent } from '../game/game-row.component';
import { gameRow, gameRows } from '../game/game-row';
import { errorText, NO_TEAM } from '../errors/error-text';
import { FollowTeamComponent } from './follow-team.component';
import { clubTeamsState } from '../club/club-teams-state';
import { SeasonOverHintComponent } from '../club/season-over-hint.component';
import { ClubTeamsComponent } from '../club/club-teams.component';
import { oldestAsOf } from '../basketball-data/as-of';
import { AsOfComponent } from '../as-of/as-of.component';
import { TeamStandingsComponent } from './team-standings.component';
import { applyClubColors } from '../club-colors/apply-club-colors';
import { breadcrumb } from '../navigation/breadcrumb';
import { ClubColorsButtonComponent } from '../club-colors/club-colors-button.component';

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
    NextGameComponent,
    RouterLink,
    SeasonOverHintComponent,
    GameRowComponent,
    AsOfComponent,
    FollowTeamComponent,
    TeamStandingsComponent,
    ClubColorsButtonComponent,
    ClubTeamsComponent,
  ],
  templateUrl: './team.component.html',
  styleUrl: './team.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamComponent {
  /** The Team's DBB id, as the route gives it. */
  public readonly teamId = input.required<string>();

  private readonly today = inject(TODAY);
  private readonly followedTeams = inject(SELECTION).teams;
  private readonly team = computed(() => parseDbbId(this.teamId()));

  protected readonly season = teamSeasonResource(() => this.team());

  /**
   * The Team to offer following: one the DBB knows, or one of Meine Teams
   * whatever its read gave (a Saison may have ended for it).
   */
  protected readonly followable = computed(() => {
    const team = this.team();
    return team !== undefined &&
      (this.season.hasValue() || this.followedTeams()?.includes(team))
      ? team
      : undefined;
  });

  protected readonly rows = computed(() =>
    this.season.hasValue() ? gameRows(this.season.value()) : []
  );

  /** The next Spiel to go to, from today on. */
  private readonly upcomingGame = computed(() =>
    this.season.hasValue()
      ? nextGame(this.season.value(), this.today())
      : undefined
  );

  protected readonly next = computed(() => {
    const game = this.upcomingGame();
    return game && this.season.hasValue()
      ? gameRow(this.season.value(), game)
      : undefined;
  });

  /** The next Spiel's details, for its Halle: that Spiel's only. */
  private readonly nextDetails = gameDetailsResource(
    () => this.upcomingGame()?.id
  );

  protected readonly nextVenue = computed(() => venueState(this.nextDetails));

  protected readonly leagues = computed(() =>
    this.season.hasValue()
      ? leaguesCurrentFirst(this.season.value(), this.today())
      : []
  );

  /** Whether the Team's Saison looks over, as of today. */
  protected readonly seasonOver = computed(
    () =>
      this.season.hasValue() && seasonOver(this.season.value(), this.today())
  );

  /**
   * The Team's Verein, kept while the next Team loads, so a sibling Team of
   * the same Verein reads it no second time.
   */
  private readonly clubId = linkedSignal<
    TeamSeason | undefined,
    ClubId | undefined
  >({
    source: () => (this.season.hasValue() ? this.season.value() : undefined),
    computation: (season, before) => season?.club.id ?? before?.value,
  });

  protected readonly clubTeams = clubTeamsResource(() => this.clubId());

  /** The Verein's Teams other than this one, as their read stands. */
  protected readonly otherTeams = computed(() => {
    const team = this.team();
    return team === undefined
      ? undefined
      : clubTeamsState(this.clubTeams, team);
  });

  /**
   * The oldest Stand of what the head shows: the Spiele, the next Spiel's
   * Halle, and the Verein's Teams while the hint offers them up there.
   */
  protected readonly headAsOf = computed(() =>
    oldestAsOf(
      this.season.asOf(),
      this.nextDetails.asOf(),
      this.seasonOver() ? this.clubTeams.asOf() : undefined
    )
  );

  protected readonly error = computed(() => {
    if (this.team() === undefined) {
      return NO_TEAM;
    }
    return errorText(this.season.error(), NO_TEAM);
  });

  public constructor() {
    // this Team's Verein only: `clubId` keeps the last one while the next loads
    applyClubColors(() =>
      this.season.hasValue() ? this.season.value().club.id : undefined
    );
    breadcrumb(() => [
      {
        title: this.season.hasValue() ? this.season.value().team.name : 'Team',
      },
    ]);
  }
}
