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
  type TeamId,
  type TeamSaison,
} from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { teamSaisonResource } from '../basketball-data/team-saison-resource';
import { HEUTE } from '../heute';
import { fehlerKarte, geladeneKarte, type TeamKarte } from './team-karte';

type Lesung = ResourceRef<TeamSaison | undefined>;

/**
 * The overview's data: one read per followed Team, each loading and
 * failing on its own. A Team followed is read once; one unfollowed has its
 * read cancelled and dropped, the others' stay as they are.
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
    inject(DestroyRef).onDestroy(() =>
      this.lesungen().forEach((lesung) => lesung.destroy())
    );
  }

  private karte(teamId: TeamId, lesung: Lesung | undefined): TeamKarte {
    if (lesung?.hasValue()) {
      return geladeneKarte(lesung.value(), this.heute());
    }
    return lesung?.status() === 'error'
      ? fehlerKarte(teamId, lesung.error())
      : { art: 'laedt', teamId };
  }

  /** A read for each of `teams`: the ones there are kept, the rest ended. */
  private abgeglichen(teams: readonly TeamId[]): ReadonlyMap<TeamId, Lesung> {
    const vorher = this.lesungen();
    for (const [teamId, lesung] of vorher) {
      if (!teams.includes(teamId)) {
        lesung.destroy();
      }
    }
    return new Map(
      teams.map((teamId) => [
        teamId,
        vorher.get(teamId) ?? teamSaisonResource(() => teamId, this.injector),
      ])
    );
  }
}
