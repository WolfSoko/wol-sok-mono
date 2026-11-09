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
  naechstesSpiel,
  saisonBeendet,
  zuletztGespielt,
  type PersonId,
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
import {
  gleicherAuftrag,
  KADER_SUCHE_SPIELE,
  kaderSucheResource,
  type KaderFunde,
} from './kader-suche';
import { fehlerKarte, geladeneKarte } from './team-karte';
import {
  ueberblickAnsicht,
  type TeamImUeberblick,
  type UeberblickAnsicht,
} from './ueberblick-ansicht';

/**
 * The reads of one followed Team: its Saison, and its next Spiel's details
 * for the Halle, which starts once that Spiel is known; the search of its
 * Kader for the marked Kinder, once its Saison is read; with the Verein
 * whose Teams to suggest once its Saison looks over.
 */
interface TeamLesungen {
  readonly saison: DatenResource<TeamSaison | undefined>;
  readonly naechsteDetails: DatenResource<SpielDetails | undefined>;
  /** None while no Kind is marked. */
  readonly kaderSuche: DatenResource<KaderFunde | undefined>;
  /** The Team's Verein once its Saison looks over (`saisonBeendet`). */
  readonly saisonEndeVerein: Signal<VereinId | undefined>;
}

/**
 * The overview's data: per followed Team its Saison and its next Spiel's
 * Halle, each loading and failing on its own; once a Kind is marked, the
 * Spielberichte of its last played Spiele (`kaderSuchen`), to tell which
 * Kind plays for it; and the Teams of each Verein one of them suggests
 * from (one read per Verein, however many of its Teams look done). A Team
 * followed is read once; one unfollowed has its reads cancelled and
 * dropped, the others' stay as they are.
 */
@Injectable()
export class MeineTeamsUeberblick {
  private readonly teams = inject(AUSWAHL).teams;
  private readonly kinder = inject(AUSWAHL).kinder;
  /** The marked Kinder's persons: a new Spitzname starts no search. */
  private readonly kinderPersonen = computed<readonly PersonId[]>(
    () => (this.kinder() ?? []).map(({ personId }) => personId),
    { equal: gleichePersonen }
  );
  private readonly heute = inject(HEUTE);
  private readonly injector = inject(Injector);
  private readonly lesungen = signal<ReadonlyMap<TeamId, TeamLesungen>>(
    new Map()
  );
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
   * The overview: each marked Kind with the Teams it plays for, and the
   * other Teams as cards (`ueberblickAnsicht`). `undefined` until Meine
   * Teams and the Kinder are read.
   */
  public readonly ansicht = computed<UeberblickAnsicht | undefined>(() => {
    const teams = this.teams();
    const kinder = this.kinder();
    if (teams === undefined || kinder === undefined) {
      return undefined;
    }
    const imUeberblick = teams.map((teamId) =>
      this.imUeberblick(teamId, this.lesungen().get(teamId), kinder.length > 0)
    );
    return ueberblickAnsicht(kinder, imUeberblick, this.heute());
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

  /**
   * `teamId` with its card and reads; `mitKindern` where a Kind is marked,
   * so its Kader is searched.
   */
  private imUeberblick(
    teamId: TeamId,
    lesung: TeamLesungen | undefined,
    mitKindern: boolean
  ): TeamImUeberblick {
    const saison = lesung?.saison;
    if (!lesung || !saison?.hasValue()) {
      return {
        karte:
          saison?.status() === 'error'
            ? fehlerKarte(teamId, saison.error())
            : { art: 'laedt', teamId },
        ...(mitKindern && { funde: 'laeuft' as const }),
      };
    }
    const verein = lesung.saisonEndeVerein();
    const vereinsTeams =
      verein === undefined ? undefined : this.vereinsLesungen().get(verein);
    const halle = hallenStand(lesung.naechsteDetails);
    const karte = geladeneKarte(saison.value(), this.heute(), {
      // the oldest of what the card shows
      stand: aeltesterStand(
        saison.stand(),
        lesung.naechsteDetails.stand(),
        vereinsTeams?.stand()
      ),
      halle,
      saisonBeendet: verein !== undefined,
      vereinsTeams: vereinsTeams && vereinsTeamsStand(vereinsTeams, teamId),
    });
    return {
      karte,
      saison: saison.value(),
      halle,
      stand: aeltesterStand(saison.stand(), lesung.naechsteDetails.stand()),
      ...(mitKindern && { funde: funde(lesung.kaderSuche) }),
    };
  }

  /**
   * The reads of `teamId`: its Saison, then its next Spiel's details; and
   * its Verein, once its Saison looks over.
   */
  private lesen(teamId: TeamId): TeamLesungen {
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
    const auftrag = computed(
      () => {
        const kinder = this.kinderPersonen();
        return saison.hasValue() && kinder.length > 0
          ? {
              team: teamId,
              spiele: zuletztGespielt(
                saison.value(),
                this.heute(),
                KADER_SUCHE_SPIELE
              ),
              kinder,
            }
          : undefined;
      },
      { equal: gleicherAuftrag }
    );
    const kaderSuche = kaderSucheResource(() => auftrag(), this.injector);
    return { saison, naechsteDetails, kaderSuche, saisonEndeVerein };
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

/** Cancels and drops every read of a Team. */
function beenden(lesung: TeamLesungen): void {
  lesung.saison.destroy();
  lesung.naechsteDetails.destroy();
  lesung.kaderSuche.destroy();
}

/**
 * What the search of a Team's Kader found; `laeuft` until it is done. A
 * search that failed as a whole counts as one stopped before any read.
 */
function funde(
  suche: DatenResource<KaderFunde | undefined>
): KaderFunde | 'laeuft' {
  if (suche.hasValue()) {
    return suche.value();
  }
  return suche.status() === 'error'
    ? { spiele: new Map(), unvollstaendig: true }
    : 'laeuft';
}

function gleichePersonen(
  a: readonly PersonId[],
  b: readonly PersonId[]
): boolean {
  return a.length === b.length && a.every((person, i) => person === b[i]);
}
