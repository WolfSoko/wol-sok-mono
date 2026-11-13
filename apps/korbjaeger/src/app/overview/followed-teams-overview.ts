import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  Injector,
  signal,
  untracked,
} from '@angular/core';
import type {
  PersonId,
  TeamId,
  ClubId,
  ClubTeams,
} from '@wolsok/feat-shared-basketball-data';
import { SELECTION } from '../selection/selection';
import type { DataResource } from '../basketball-data/basketball-data-resource';
import { clubTeamsResource } from '../basketball-data/club-teams-resource';
import { sameSequence } from '@wolsok/feat-korbjaeger-selection';
import { TODAY } from '../today';
import { reconcile } from '../reconcile';
import { teamInOverview } from './team-in-overview';
import { stopReadings, teamReadings, type TeamReadings } from './team-readings';
import { overviewView, type OverviewView } from './overview-view';

/**
 * The overview's data: per followed Team its reads (`teamReadings`), and
 * the Teams of each Verein one of them suggests from (one read per
 * Verein, however many of its Teams look done). A Team followed is read
 * once; one unfollowed has its reads cancelled and dropped, the others'
 * stay as they are (`reconcile`).
 */
@Injectable()
export class FollowedTeamsOverview {
  private readonly selection = inject(SELECTION);
  /** Whether Meine Teams and the Kinder cannot be read: no overview then. */
  public readonly unreadable = this.selection.unreadable;
  /** The marked Kinder's persons: a new Spitzname starts no search. */
  private readonly childPersonIds = computed<readonly PersonId[]>(
    () => (this.selection.children() ?? []).map(({ personId }) => personId),
    { equal: sameSequence }
  );
  private readonly today = inject(TODAY);
  private readonly injector = inject(Injector);
  private readonly readings = signal<ReadonlyMap<TeamId, TeamReadings>>(
    new Map()
  );
  private readonly clubReadings = signal<
    ReadonlyMap<ClubId, DataResource<ClubTeams | undefined>>
  >(new Map());

  /** The Vereine to suggest Teams from: of each Team whose Saison looks over. */
  private readonly searchedClubs = computed(
    () =>
      new Set(
        [...this.readings().values()]
          .map((reading) => reading.seasonOverClub())
          .filter((club): club is ClubId => club !== undefined)
      )
  );

  /**
   * The overview: each marked Kind with the Teams it plays for, and the
   * other Teams as cards (`overviewView`). `undefined` until Meine
   * Teams and the Kinder are read.
   */
  public readonly view = computed<OverviewView | undefined>(() => {
    const teams = this.selection.teams();
    const children = this.selection.children();
    if (teams === undefined || children === undefined) {
      return undefined;
    }
    const inOverview = teams.map((teamId) =>
      teamInOverview(
        teamId,
        this.readings().get(teamId),
        (club) => this.clubReadings().get(club),
        children.length > 0
      )
    );
    return overviewView(children, inOverview, this.today());
  });

  public constructor() {
    const environment = {
      today: this.today,
      children: this.childPersonIds,
      injector: this.injector,
    };
    effect(() => {
      const teams = this.selection.teams() ?? [];
      untracked(() =>
        this.readings.update((before) =>
          reconcile(
            before,
            teams,
            (teamId) => teamReadings(teamId, environment),
            stopReadings
          )
        )
      );
    });
    effect(() => {
      const clubs = this.searchedClubs();
      untracked(() =>
        this.clubReadings.update((before) =>
          reconcile(
            before,
            clubs,
            (club) => clubTeamsResource(() => club, this.injector),
            (read) => read.destroy()
          )
        )
      );
    });
    inject(DestroyRef).onDestroy(() => {
      this.readings().forEach(stopReadings);
      this.clubReadings().forEach((read) => read.destroy());
    });
  }
}
