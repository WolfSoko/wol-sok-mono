import {
  computed,
  linkedSignal,
  type Injector,
  type Signal,
} from '@angular/core';
import {
  nextGame,
  seasonOver,
  teamOverview,
  lastPlayed,
  type RosterFinds,
  type PersonId,
  type GameDetails,
  type TeamId,
  type TeamSeason,
  type TeamOverview,
  type ClubId,
} from '@wolsok/feat-shared-basketball-data';
import type { DataResource } from '../basketball-data/basketball-data-resource';
import { gameDetailsResource } from '../basketball-data/game-details-resource';
import { teamSeasonResource } from '../basketball-data/team-season-resource';
import {
  findsAfter,
  searchEnd,
  searching,
  type SearchEnd,
} from './roster-finds';
import {
  sameJob,
  ROSTER_SEARCH_GAMES,
  rosterSearchResource,
} from './roster-search';

/**
 * The reads of one followed Team: its Saison, and its next Spiel's details
 * for the Halle, which starts once that Spiel is known; the search of its
 * Kader for the marked Kinder, once its Saison is read; with the Verein
 * whose Teams to suggest once its Saison looks over.
 */
export interface TeamReadings {
  readonly season: DataResource<TeamSeason | undefined>;
  /** Its overview (`teamOverview`) on `today`, once its Saison is read. */
  readonly overview: Signal<TeamOverview | undefined>;
  readonly nextDetails: DataResource<GameDetails | undefined>;
  /** None while no Kind is marked. */
  readonly rosterSearch: DataResource<RosterFinds | undefined>;
  /** Whether its Kader is still searched, or has yet to be. */
  readonly searching: Signal<boolean>;
  /**
   * What the last search that ended found, kept while it runs again; a run
   * that failed as a whole keeps those too, marked `incomplete`.
   */
  readonly finds: Signal<RosterFinds | undefined>;
  /** The Team's Verein once its Saison looks over (`seasonOver`). */
  readonly seasonOverClub: Signal<ClubId | undefined>;
}

/** What a Team's reads follow beside the Team. */
export interface ReadingEnvironment {
  /** The German calendar day (`TODAY`). */
  readonly today: () => string;
  /** The marked Kinder's persons; none, and no Kader is searched. */
  readonly children: () => readonly PersonId[];
  /** Where the reads live: they end with it, or with `stopReadings`. */
  readonly injector: Injector;
}

/**
 * The reads of `teamId`: its Saison, then its next Spiel's details; its
 * Kader searched for the marked Kinder once its Saison is read; and its
 * Verein, once its Saison looks over.
 */
export function teamReadings(
  teamId: TeamId,
  { today, children, injector }: ReadingEnvironment
): TeamReadings {
  const season = teamSeasonResource(() => teamId, injector);
  const nextDetails = gameDetailsResource(
    () =>
      season.hasValue() ? nextGame(season.value(), today())?.id : undefined,
    injector
  );
  const seasonOverClub = computed(() =>
    season.hasValue() && seasonOver(season.value(), today())
      ? season.value().club.id
      : undefined
  );
  const job = computed(
    () => {
      const personIds = children();
      return season.hasValue() && personIds.length > 0
        ? {
            team: teamId,
            games: lastPlayed(season.value(), today(), ROSTER_SEARCH_GAMES),
            children: personIds,
          }
        : undefined;
    },
    { equal: sameJob }
  );
  const rosterSearch = rosterSearchResource(() => job(), injector);
  // a new order clears the resource's value: the last finds stay shown
  const finds = linkedSignal<SearchEnd | undefined, RosterFinds | undefined>({
    source: () => searchEnd(rosterSearch.snapshot()),
    computation: (end, before) => findsAfter(end, before?.value),
  });
  const overview = computed(() =>
    season.hasValue() ? teamOverview(season.value(), today()) : undefined
  );
  return {
    season,
    overview,
    nextDetails,
    rosterSearch,
    searching: computed(() => searching(rosterSearch.snapshot())),
    finds,
    seasonOverClub,
  };
}

/** Cancels and drops every read of a Team. */
export function stopReadings(reading: TeamReadings): void {
  reading.season.destroy();
  reading.nextDetails.destroy();
  reading.rosterSearch.destroy();
}
