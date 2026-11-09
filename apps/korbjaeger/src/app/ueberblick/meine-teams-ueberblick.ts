import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  Injector,
  linkedSignal,
  signal,
  untracked,
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
  type VereinsTeams,
} from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import type { DatenResource } from '../basketball-data/basketball-data-resource';
import { aeltesterStand } from '../basketball-data/stand';
import { spielDetailsResource } from '../basketball-data/spiel-details-resource';
import { teamSaisonResource } from '../basketball-data/team-saison-resource';
import { vereinsTeamsResource } from '../basketball-data/vereins-teams-resource';
import { gleicheFolge } from '@wolsok/feat-korbjaeger-auswahl';
import { hallenStand } from '../halle/hallen-stand';
import { HEUTE } from '../heute';
import { vereinsTeamsStand } from '../verein/vereins-teams-stand';
import {
  gleicherAuftrag,
  KADER_SUCHE_SPIELE,
  kaderSucheResource,
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
  /** Its overview (`teamUeberblick`) on `HEUTE`, once its Saison is read. */
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
  private readonly auswahl = inject(AUSWAHL);
  private readonly teams = this.auswahl.teams;
  private readonly kinder = this.auswahl.kinder;
  /** Whether Meine Teams and the Kinder cannot be read: no overview then. */
  public readonly nichtLesbar = this.auswahl.nichtLesbar;
  /** The marked Kinder's persons: a new Spitzname starts no search. */
  private readonly kinderPersonen = computed<readonly PersonId[]>(
    () => (this.kinder() ?? []).map(({ personId }) => personId),
    { equal: gleicheFolge }
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
   * so its Kader is searched. A Team whose Saison failed ends its search
   * there, unable to tell (`unvollstaendig`).
   */
  private imUeberblick(
    teamId: TeamId,
    lesung: TeamLesungen | undefined,
    mitKindern: boolean
  ): TeamImUeberblick {
    const saison = lesung?.saison;
    if (saison?.status() === 'error') {
      return {
        karte: fehlerKarte(teamId, saison.error()),
        ...(mitKindern && { funde: NICHT_LESBAR }),
        sucht: false,
      };
    }
    const ueberblick = lesung?.ueberblick();
    if (!lesung || !saison?.hasValue() || ueberblick === undefined) {
      return { karte: { art: 'laedt', teamId }, sucht: mitKindern };
    }
    const verein = lesung.saisonEndeVerein();
    const vereinsTeams =
      verein === undefined ? undefined : this.vereinsLesungen().get(verein);
    const halle = hallenStand(lesung.naechsteDetails);
    const karte = geladeneKarte(saison.value(), ueberblick, {
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
    const funde = mitKindern ? lesung.funde() : undefined;
    return {
      karte,
      saison: { saison: saison.value(), ueberblick },
      halle,
      stand: aeltesterStand(saison.stand(), lesung.naechsteDetails.stand()),
      ...(funde && { funde }),
      sucht: mitKindern && sucht(lesung.kaderSuche),
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
    // a new order clears the resource's value: the last finds stay shown
    const funde = linkedSignal<SuchEnde | undefined, KaderFunde | undefined>({
      source: () => suchEnde(kaderSuche),
      computation: (ende, vorher) => fundeNach(ende, vorher?.value),
    });
    const ueberblick = computed(() =>
      saison.hasValue()
        ? teamUeberblick(saison.value(), this.heute())
        : undefined
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

/** A search that could read nothing: its Team's Saison failed. */
const NICHT_LESBAR: KaderFunde = { spiele: new Map(), unvollstaendig: true };

/** How a search of a Team's Kader ended: with its finds, or failed. */
type SuchEnde =
  | { readonly art: 'gefunden'; readonly funde: KaderFunde }
  | { readonly art: 'gescheitert' };

/** How a search of a Team's Kader ended; none while it runs. */
function suchEnde(
  suche: DatenResource<KaderFunde | undefined>
): SuchEnde | undefined {
  if (suche.hasValue()) {
    return { art: 'gefunden', funde: suche.value() };
  }
  return suche.status() === 'error' ? { art: 'gescheitert' } : undefined;
}

/**
 * The finds to show after `ende`, the last ones being `vorher`: a run that
 * failed as a whole keeps them, marked `unvollstaendig`, or reads as one
 * that read nothing; one still running keeps them as they are.
 */
function fundeNach(
  ende: SuchEnde | undefined,
  vorher: KaderFunde | undefined
): KaderFunde | undefined {
  switch (ende?.art) {
    case 'gefunden':
      return ende.funde;
    case 'gescheitert':
      return vorher ? { ...vorher, unvollstaendig: true } : NICHT_LESBAR;
    case undefined:
      return vorher;
  }
}

/** Whether a search of a Team's Kader still runs, or has yet to start. */
function sucht(suche: DatenResource<KaderFunde | undefined>): boolean {
  return suche.isLoading() || suchEnde(suche) === undefined;
}
