import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  Injector,
  signal,
  untracked,
  type ResourceRef,
} from '@angular/core';
import {
  nachNaechstemSpiel,
  naechstesSpiel,
  saisonBeendet,
  type SpielDetails,
  type TeamId,
  type TeamSaison,
  type VereinsTeams,
} from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { spielDetailsResource } from '../basketball-data/spiel-details-resource';
import { teamSaisonResource } from '../basketball-data/team-saison-resource';
import { vereinsTeamsResource } from '../basketball-data/vereins-teams-resource';
import { hallenStand } from '../halle/hallen-stand';
import { HEUTE } from '../heute';
import { vereinsTeamsStand } from '../verein/vereins-teams-stand';
import { fehlerKarte, geladeneKarte, type TeamKarte } from './team-karte';

/**
 * The reads of one followed Team: its Saison; its next Spiel's details for
 * the Halle, which starts once that Spiel is known; and its Verein's Teams
 * to suggest, which starts once its Saison is over.
 */
interface Lesung {
  readonly saison: ResourceRef<TeamSaison | undefined>;
  readonly naechsteDetails: ResourceRef<SpielDetails | undefined>;
  readonly vereinsTeams: ResourceRef<VereinsTeams | undefined>;
}

/**
 * The overview's data: per followed Team its Saison and its next Spiel's
 * Halle, each loading and failing on its own. A Team followed is read
 * once; one unfollowed has its reads cancelled and dropped, the others'
 * stay as they are.
 */
@Injectable()
export class MeineTeamsUeberblick {
  private readonly teams = inject(AUSWAHL).teams;
  private readonly heute = inject(HEUTE);
  private readonly injector = inject(Injector);
  private readonly lesungen = signal<ReadonlyMap<TeamId, Lesung>>(new Map());

  /**
   * Each of Meine Teams as its card, the Team that plays first first
   * (`nachNaechstemSpiel`); cards still loading or failed follow, in the
   * order they were followed. `undefined` until Meine Teams are read.
   */
  public readonly karten = computed<readonly TeamKarte[] | undefined>(() => {
    const teams = this.teams();
    if (teams === undefined) {
      return undefined;
    }
    const karten = teams.map((teamId) =>
      this.karte(teamId, this.lesungen().get(teamId))
    );
    return nachNaechstemSpiel(karten, (karte) =>
      karte.art === 'geladen' ? karte.naechstesSpiel : undefined
    );
  });

  public constructor() {
    effect(() => {
      const teams = this.teams() ?? [];
      untracked(() => this.lesungen.set(this.abgeglichen(teams)));
    });
    inject(DestroyRef).onDestroy(() => this.lesungen().forEach(beenden));
  }

  private karte(teamId: TeamId, lesung: Lesung | undefined): TeamKarte {
    const saison = lesung?.saison;
    if (lesung && saison?.hasValue()) {
      return geladeneKarte(
        saison.value(),
        this.heute(),
        hallenStand(lesung.naechsteDetails),
        vereinsTeamsStand(lesung.vereinsTeams, teamId)
      );
    }
    return saison?.status() === 'error'
      ? fehlerKarte(teamId, saison.error())
      : { art: 'laedt', teamId };
  }

  /** A read for each of `teams`: the ones there are kept, the rest ended. */
  private abgeglichen(teams: readonly TeamId[]): ReadonlyMap<TeamId, Lesung> {
    const vorher = this.lesungen();
    for (const [teamId, lesung] of vorher) {
      if (!teams.includes(teamId)) {
        beenden(lesung);
      }
    }
    return new Map(
      teams.map((teamId) => [teamId, vorher.get(teamId) ?? this.lesen(teamId)])
    );
  }

  /**
   * The reads of `teamId`: its Saison, then its next Spiel's details, or
   * its Verein's Teams once its Saison is over.
   */
  private lesen(teamId: TeamId): Lesung {
    const saison = teamSaisonResource(() => teamId, this.injector);
    const naechsteDetails = spielDetailsResource(
      () =>
        saison.hasValue()
          ? naechstesSpiel(saison.value(), this.heute())?.id
          : undefined,
      this.injector
    );
    const vereinsTeams = vereinsTeamsResource(
      () =>
        saison.hasValue() && saisonBeendet(saison.value(), this.heute())
          ? saison.value().verein.id
          : undefined,
      this.injector
    );
    return { saison, naechsteDetails, vereinsTeams };
  }
}

/** Cancels and drops every read of a Team. */
function beenden(lesung: Lesung): void {
  lesung.saison.destroy();
  lesung.naechsteDetails.destroy();
  lesung.vereinsTeams.destroy();
}
