import {
  computed,
  linkedSignal,
  type Injector,
  type Signal,
} from '@angular/core';
import {
  naechstesSpiel,
  saisonBeendet,
  teamUeberblick,
  zuletztGespielt,
  type KaderFunde,
  type PersonId,
  type SpielDetails,
  type TeamId,
  type TeamSaison,
  type TeamUeberblick,
  type VereinId,
} from '@wolsok/feat-shared-basketball-data';
import type { DatenResource } from '../basketball-data/basketball-data-resource';
import { spielDetailsResource } from '../basketball-data/spiel-details-resource';
import { teamSaisonResource } from '../basketball-data/team-saison-resource';
import { fundeNach, suchEnde, type SuchEnde } from './kader-funde';
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
  readonly saison: DatenResource<TeamSaison | undefined>;
  /** Its overview (`teamUeberblick`) on `heute`, once its Saison is read. */
  readonly ueberblick: Signal<TeamUeberblick | undefined>;
  readonly naechsteDetails: DatenResource<SpielDetails | undefined>;
  /** None while no Kind is marked. */
  readonly kaderSuche: DatenResource<KaderFunde | undefined>;
  /**
   * What the last search that ended found, kept while it runs again; a run
   * that failed as a whole keeps those too, marked `unvollstaendig`.
   */
  readonly funde: Signal<KaderFunde | undefined>;
  /** The Team's Verein once its Saison looks over (`saisonBeendet`). */
  readonly saisonEndeVerein: Signal<VereinId | undefined>;
}

/** What a Team's reads follow beside the Team. */
export interface LesungsUmgebung {
  /** The German calendar day (`HEUTE`). */
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
  const saison = teamSaisonResource(() => teamId, injector);
  const naechsteDetails = spielDetailsResource(
    () =>
      saison.hasValue()
        ? naechstesSpiel(saison.value(), heute())?.id
        : undefined,
    injector
  );
  const saisonEndeVerein = computed(() =>
    saison.hasValue() && saisonBeendet(saison.value(), heute())
      ? saison.value().verein.id
      : undefined
  );
  const auftrag = computed(
    () => {
      const personen = kinder();
      return saison.hasValue() && personen.length > 0
        ? {
            team: teamId,
            spiele: zuletztGespielt(
              saison.value(),
              heute(),
              KADER_SUCHE_SPIELE
            ),
            kinder: personen,
          }
        : undefined;
    },
    { equal: gleicherAuftrag }
  );
  const kaderSuche = kaderSucheResource(() => auftrag(), injector);
  // a new order clears the resource's value: the last finds stay shown
  const funde = linkedSignal<SuchEnde | undefined, KaderFunde | undefined>({
    source: () => suchEnde(kaderSuche),
    computation: (ende, vorher) => fundeNach(ende, vorher?.value),
  });
  const ueberblick = computed(() =>
    saison.hasValue() ? teamUeberblick(saison.value(), heute()) : undefined
  );
  return {
    saison,
    ueberblick,
    naechsteDetails,
    kaderSuche,
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
