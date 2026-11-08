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
  type Signal,
} from '@angular/core';
import {
  nachNaechstemSpiel,
  naechstesSpiel,
  saisonBeendet,
  type SpielDetails,
  type TeamId,
  type TeamSaison,
  type VereinId,
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
 * The reads of one followed Team: its Saison, and its next Spiel's details
 * for the Halle, which starts once that Spiel is known; with the Verein
 * whose Teams to suggest once its Saison looks over.
 */
interface Lesung {
  readonly saison: ResourceRef<TeamSaison | undefined>;
  readonly naechsteDetails: ResourceRef<SpielDetails | undefined>;
  /** The Team's Verein once its Saison looks over (`saisonBeendet`). */
  readonly saisonEndeVerein: Signal<VereinId | undefined>;
}

/**
 * The overview's data: per followed Team its Saison and its next Spiel's
 * Halle, each loading and failing on its own, and the Teams of each
 * Verein one of them suggests from (one read per Verein, however many of
 * its Teams look done). A Team followed is read once; one unfollowed has
 * its reads cancelled and dropped, the others' stay as they are.
 */
@Injectable()
export class MeineTeamsUeberblick {
  private readonly teams = inject(AUSWAHL).teams;
  private readonly heute = inject(HEUTE);
  private readonly injector = inject(Injector);
  private readonly lesungen = signal<ReadonlyMap<TeamId, Lesung>>(new Map());
  private readonly vereinsLesungen = signal<
    ReadonlyMap<VereinId, ResourceRef<VereinsTeams | undefined>>
  >(new Map());

  /** The Vereine to suggest Teams from: of each Team whose Saison looks over. */
  private readonly gesuchteVereine = computed(
    () =>
      new Set(
        [...this.lesungen().values()]
          .map((lesung) => lesung.saisonEndeVerein())
          .filter((verein): verein is VereinId => verein !== undefined)
      )
  );

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
    effect(() => {
      const vereine = this.gesuchteVereine();
      untracked(() =>
        this.vereinsLesungen.set(this.vereineAbgeglichen(vereine))
      );
    });
    inject(DestroyRef).onDestroy(() => {
      this.lesungen().forEach(beenden);
      this.vereinsLesungen().forEach((read) => read.destroy());
    });
  }

  private karte(teamId: TeamId, lesung: Lesung | undefined): TeamKarte {
    const saison = lesung?.saison;
    if (lesung && saison?.hasValue()) {
      const verein = lesung.saisonEndeVerein();
      const vereinsTeams =
        verein === undefined ? undefined : this.vereinsLesungen().get(verein);
      return geladeneKarte(saison.value(), this.heute(), {
        halle: hallenStand(lesung.naechsteDetails),
        saisonBeendet: verein !== undefined,
        vereinsTeams: vereinsTeams && vereinsTeamsStand(vereinsTeams, teamId),
      });
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

  /** A read for each of `vereine`: the ones there are kept, the rest ended. */
  private vereineAbgeglichen(
    vereine: ReadonlySet<VereinId>
  ): ReadonlyMap<VereinId, ResourceRef<VereinsTeams | undefined>> {
    const vorher = this.vereinsLesungen();
    for (const [verein, read] of vorher) {
      if (!vereine.has(verein)) {
        read.destroy();
      }
    }
    return new Map(
      [...vereine].map((verein) => [
        verein,
        vorher.get(verein) ?? vereinsTeamsResource(() => verein, this.injector),
      ])
    );
  }

  /**
   * The reads of `teamId`: its Saison, then its next Spiel's details; and
   * its Verein, once its Saison looks over.
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
    const saisonEndeVerein = computed(() =>
      saison.hasValue() && saisonBeendet(saison.value(), this.heute())
        ? saison.value().verein.id
        : undefined
    );
    return { saison, naechsteDetails, saisonEndeVerein };
  }
}

/** Cancels and drops both reads of a Team. */
function beenden(lesung: Lesung): void {
  lesung.saison.destroy();
  lesung.naechsteDetails.destroy();
}
