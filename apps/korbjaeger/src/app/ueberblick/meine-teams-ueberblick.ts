import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  Injector,
  signal,
  untracked,
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
import type { DatenResource } from '../basketball-data/basketball-data-resource';
import { aeltesterStand } from '../basketball-data/stand';
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
  readonly saison: DatenResource<TeamSaison | undefined>;
  readonly naechsteDetails: DatenResource<SpielDetails | undefined>;
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
    ReadonlyMap<VereinId, DatenResource<VereinsTeams | undefined>>
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
      untracked(() =>
        this.lesungen.set(
          abgleichen(
            this.lesungen(),
            teams,
            (teamId) => this.lesen(teamId),
            beenden
          )
        )
      );
    });
    effect(() => {
      const vereine = this.gesuchteVereine();
      untracked(() =>
        this.vereinsLesungen.set(
          abgleichen(
            this.vereinsLesungen(),
            vereine,
            (verein) => vereinsTeamsResource(() => verein, this.injector),
            vereinBeenden
          )
        )
      );
    });
    inject(DestroyRef).onDestroy(() => {
      this.lesungen().forEach(beenden);
      this.vereinsLesungen().forEach(vereinBeenden);
    });
  }

  private karte(teamId: TeamId, lesung: Lesung | undefined): TeamKarte {
    const saison = lesung?.saison;
    if (lesung && saison?.hasValue()) {
      const verein = lesung.saisonEndeVerein();
      const vereinsTeams =
        verein === undefined ? undefined : this.vereinsLesungen().get(verein);
      return geladeneKarte(saison.value(), this.heute(), {
        // the oldest of what the card shows
        stand: aeltesterStand(
          saison.stand(),
          lesung.naechsteDetails.stand(),
          vereinsTeams?.stand()
        ),
        halle: hallenStand(lesung.naechsteDetails),
        saisonBeendet: verein !== undefined,
        vereinsTeams: vereinsTeams && vereinsTeamsStand(vereinsTeams, teamId),
      });
    }
    return saison?.status() === 'error'
      ? fehlerKarte(teamId, saison.error())
      : { art: 'laedt', teamId };
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

/**
 * An entry for each of `keys`, in their order: those in `vorher` kept,
 * the others made by `lesen`; the entries of `vorher` no key names are
 * handed to `ende`.
 */
function abgleichen<K, V>(
  vorher: ReadonlyMap<K, V>,
  keys: Iterable<K>,
  lesen: (key: K) => V,
  ende: (eintrag: V) => void
): ReadonlyMap<K, V> {
  const gesucht = new Set(keys);
  for (const [key, eintrag] of vorher) {
    if (!gesucht.has(key)) {
      ende(eintrag);
    }
  }
  return new Map(
    [...gesucht].map((key) => [key, vorher.get(key) ?? lesen(key)])
  );
}

/** Cancels and drops the read of a Verein's Teams. */
function vereinBeenden(read: DatenResource<VereinsTeams | undefined>): void {
  read.destroy();
}

/** Cancels and drops both reads of a Team. */
function beenden(lesung: Lesung): void {
  lesung.saison.destroy();
  lesung.naechsteDetails.destroy();
}
