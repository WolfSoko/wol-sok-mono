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
import { fundeNach, suchEnde, sucht, type SuchEnde } from './kader-funde';
import {
  gleicherAuftrag,
  KADER_SUCHE_SPIELE,
  kaderSucheResource,
} from './kader-suche';

/**
 * The reads of one followed Team: its Saison, and its next Spiel's details
 * for the Halle, which starts once that Spiel is known; the search of its
 * Kader for the marked Kinder, once its Saison is read; with the Verein
 * whose Teams to suggest once its Saison looks over.
 */
export interface TeamLesungen {
  readonly saison: DataResource<TeamSeason | undefined>;
  /** Its overview (`teamOverview`) on `heute`, once its Saison is read. */
  readonly ueberblick: Signal<TeamOverview | undefined>;
  readonly naechsteDetails: DataResource<GameDetails | undefined>;
  /** None while no Kind is marked. */
  readonly kaderSuche: DataResource<RosterFinds | undefined>;
  /** Whether its Kader is still searched, or has yet to be. */
  readonly sucht: Signal<boolean>;
  /**
   * What the last search that ended found, kept while it runs again; a run
   * that failed as a whole keeps those too, marked `unvollstaendig`.
   */
  readonly funde: Signal<RosterFinds | undefined>;
  /** The Team's Verein once its Saison looks over (`seasonOver`). */
  readonly saisonEndeVerein: Signal<ClubId | undefined>;
}

/** What a Team's reads follow beside the Team. */
export interface LesungsUmgebung {
  /** The German calendar day (`TODAY`). */
  readonly heute: () => string;
  /** The marked Kinder's persons; none, and no Kader is searched. */
  readonly kinder: () => readonly PersonId[];
  /** Where the reads live: they end with it, or with `lesungenBeenden`. */
  readonly injector: Injector;
}

/**
 * The reads of `teamId`: its Saison, then its next Spiel's details; its
 * Kader searched for the marked Kinder once its Saison is read; and its
 * Verein, once its Saison looks over.
 */
export function teamLesungen(
  teamId: TeamId,
  { heute, kinder, injector }: LesungsUmgebung
): TeamLesungen {
  const saison = teamSeasonResource(() => teamId, injector);
  const naechsteDetails = gameDetailsResource(
    () =>
      saison.hasValue() ? nextGame(saison.value(), heute())?.id : undefined,
    injector
  );
  const saisonEndeVerein = computed(() =>
    saison.hasValue() && seasonOver(saison.value(), heute())
      ? saison.value().club.id
      : undefined
  );
  const auftrag = computed(
    () => {
      const personen = kinder();
      return saison.hasValue() && personen.length > 0
        ? {
            team: teamId,
            games: lastPlayed(saison.value(), heute(), KADER_SUCHE_SPIELE),
            children: personen,
          }
        : undefined;
    },
    { equal: gleicherAuftrag }
  );
  const kaderSuche = kaderSucheResource(() => auftrag(), injector);
  // a new order clears the resource's value: the last finds stay shown
  const funde = linkedSignal<SuchEnde | undefined, RosterFinds | undefined>({
    source: () => suchEnde(kaderSuche.snapshot()),
    computation: (ende, vorher) => fundeNach(ende, vorher?.value),
  });
  const ueberblick = computed(() =>
    saison.hasValue() ? teamOverview(saison.value(), heute()) : undefined
  );
  return {
    saison,
    ueberblick,
    naechsteDetails,
    kaderSuche,
    sucht: computed(() => sucht(kaderSuche.snapshot())),
    funde,
    saisonEndeVerein,
  };
}

/** Cancels and drops every read of a Team. */
export function lesungenBeenden(lesung: TeamLesungen): void {
  lesung.saison.destroy();
  lesung.naechsteDetails.destroy();
  lesung.kaderSuche.destroy();
}
