import type { BasketballData, ReadOptions } from '../basketball-data';
import {
  BasketballDataError,
  isBasketballDataError,
} from '../domain/basketball-data-error';
import type { LigaId, SpielId, TeamId, VereinId } from '../domain/ids';
import type {
  LigaSeite,
  LigaSuche,
  LigaSucheFilter,
} from '../domain/liga-suche';
import type { SpielDetails } from '../domain/spiel';
import type { Spielbericht } from '../domain/spielbericht';
import type { Tabelle } from '../domain/tabelle';
import type { Team } from '../domain/team';
import type { TeamSaison, VereinsTeams } from '../domain/team-saison';
import {
  assertValidDbbRequest,
  dbbIdOf,
  isDbbId,
  type DbbRequest,
  type DbbTransport,
} from './dbb-request';
import { readEnvelope } from './envelope';
import { mapLigaSeite, mapLigaSuche } from './map-liga-suche';
import { mapLigaTeams } from './map-liga-teams';
import { mapSpielDetails } from './map-spiel-details';
import { mapSpielbericht } from './map-spielbericht';
import { mapTabelle } from './map-tabelle';
import { mapTeamSpiele } from './map-team-spiele';
import { mapVereinsTeams } from './map-vereins-teams';

/**
 * How far either way a Verein's Spiele are looked at for its Teams: four
 * weeks, so a Team pausing over the holidays still shows, and a Team whose
 * Saison ended (two weeks after its last Spiel, `saisonBeendet`) still
 * finds the Verein's Teams that ended about when it did; ahead, the next
 * Saison's Teams show once their first Spiele are set. Wider would cost
 * every read a longer list for little gain.
 */
export const VEREINS_SPIELE_TAGE = 28;

/**
 * `BasketballData` read from the DBB's JSON API through `transport`, which
 * answers each allowlisted `DbbRequest` with the DBB's JSON: directly in a
 * tool, through the app's caching proxy in the browser.
 */
export class DbbBasketballData implements BasketballData {
  public constructor(private readonly transport: DbbTransport) {}

  public ligaSuche(
    filter: LigaSucheFilter,
    options?: ReadOptions
  ): Promise<LigaSuche> {
    return this.read({ kind: 'liga-suche', filter }, mapLigaSuche, options);
  }

  public ligaSeite(
    filter: LigaSucheFilter,
    startIndex: number,
    options?: ReadOptions
  ): Promise<LigaSeite> {
    return this.read(
      { kind: 'liga-seite', filter, startIndex },
      mapLigaSeite,
      options
    );
  }

  public ligaTeams(
    liga: LigaId,
    options?: ReadOptions
  ): Promise<readonly Team[]> {
    return this.read(
      { kind: 'spielplan', ligaId: liga },
      mapLigaTeams,
      options
    );
  }

  public vereinsTeams(
    verein: VereinId,
    options?: ReadOptions
  ): Promise<VereinsTeams> {
    return this.read(
      { kind: 'vereins-spiele', vereinId: verein, tage: VEREINS_SPIELE_TAGE },
      mapVereinsTeams,
      options
    );
  }

  public teamSpiele(team: TeamId, options?: ReadOptions): Promise<TeamSaison> {
    return this.read(
      { kind: 'team-spiele', teamId: team },
      mapTeamSpiele,
      options
    );
  }

  public tabelle(liga: LigaId, options?: ReadOptions): Promise<Tabelle> {
    return this.read({ kind: 'tabelle', ligaId: liga }, mapTabelle, options);
  }

  public spiel(spiel: SpielId, options?: ReadOptions): Promise<SpielDetails> {
    return this.read(
      { kind: 'spiel-info', spielId: spiel },
      mapSpielDetails,
      options
    );
  }

  public spielbericht(
    spiel: SpielId,
    options?: ReadOptions
  ): Promise<Spielbericht | undefined> {
    return this.read(
      { kind: 'spielbericht', spielId: spiel },
      mapSpielbericht,
      options
    );
  }

  private async read<T>(
    request: DbbRequest,
    map: (data: unknown) => T,
    options: ReadOptions = {}
  ): Promise<T> {
    assertKnowable(request);
    options.signal?.throwIfAborted();
    return map(readEnvelope(await this.fetch(request, options)));
  }

  private async fetch(
    request: DbbRequest,
    options: ReadOptions
  ): Promise<unknown> {
    try {
      return await this.transport(request, options);
    } catch (error) {
      options.signal?.throwIfAborted();
      if (isBasketballDataError(error)) {
        throw error;
      }
      throw new BasketballDataError(
        'unavailable',
        `DBB not reachable for ${request.kind}`,
        { cause: error }
      );
    }
  }
}

/**
 * Checks `request` before the transport sees it. An id the DBB cannot have
 * names nothing it knows: `not-found`. Anything else wrong (a negative
 * start index, a malformed filter) is the caller's bug and throws its
 * `RangeError` as it is. What the transport throws afterwards is the
 * DBB's or the network's trouble: `unavailable`.
 */
function assertKnowable(request: DbbRequest): void {
  const id = dbbIdOf(request);
  if (id !== undefined && !isDbbId(id)) {
    throw new BasketballDataError('not-found', `not a DBB id: ${id}`);
  }
  assertValidDbbRequest(request);
}
