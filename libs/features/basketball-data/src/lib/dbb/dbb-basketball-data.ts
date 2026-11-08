import type { BasketballData } from '../basketball-data';
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

/** How far either way a Verein's Spiele are looked at for its Teams. */
export const VEREINS_SPIELE_TAGE = 21;

/**
 * `BasketballData` read from the DBB's JSON API through `transport`, which
 * answers each allowlisted `DbbRequest` with the DBB's JSON: directly in a
 * tool, through the app's caching proxy in the browser.
 */
export class DbbBasketballData implements BasketballData {
  public constructor(private readonly transport: DbbTransport) {}

  public ligaSuche(filter: LigaSucheFilter): Promise<LigaSuche> {
    return this.read({ kind: 'liga-suche', filter }, mapLigaSuche);
  }

  public ligaSeite(
    filter: LigaSucheFilter,
    startIndex: number
  ): Promise<LigaSeite> {
    return this.read({ kind: 'liga-seite', filter, startIndex }, mapLigaSeite);
  }

  public ligaTeams(liga: LigaId): Promise<readonly Team[]> {
    return this.read({ kind: 'spielplan', ligaId: liga }, mapLigaTeams);
  }

  public vereinsTeams(verein: VereinId): Promise<VereinsTeams> {
    return this.read(
      { kind: 'vereins-spiele', vereinId: verein, tage: VEREINS_SPIELE_TAGE },
      mapVereinsTeams
    );
  }

  public teamSpiele(team: TeamId): Promise<TeamSaison> {
    return this.read({ kind: 'team-spiele', teamId: team }, mapTeamSpiele);
  }

  public tabelle(liga: LigaId): Promise<Tabelle> {
    return this.read({ kind: 'tabelle', ligaId: liga }, mapTabelle);
  }

  public spiel(spiel: SpielId): Promise<SpielDetails> {
    return this.read({ kind: 'spiel-info', spielId: spiel }, mapSpielDetails);
  }

  public spielbericht(spiel: SpielId): Promise<Spielbericht | undefined> {
    return this.read({ kind: 'spielbericht', spielId: spiel }, mapSpielbericht);
  }

  private async read<T>(
    request: DbbRequest,
    map: (data: unknown) => T
  ): Promise<T> {
    assertKnowable(request);
    return map(readEnvelope(await this.fetch(request)));
  }

  private async fetch(request: DbbRequest): Promise<unknown> {
    try {
      return await this.transport(request);
    } catch (error) {
      if (isBasketballDataError(error) || error instanceof RangeError) {
        throw error;
      }
      throw new BasketballDataError(
        'unavailable',
        `DBB not reachable for ${request.kind}`,
        {
          cause: error,
        }
      );
    }
  }
}

/**
 * An id the DBB cannot have names nothing it knows. Anything else wrong
 * with a request (a negative start index, a malformed filter) is the
 * caller's bug: the transport's `RangeError` reaches the caller as it is.
 */
function assertKnowable(request: DbbRequest): void {
  const id = dbbIdOf(request);
  if (id !== undefined && !isDbbId(id)) {
    throw new BasketballDataError('not-found', `not a DBB id: ${id}`);
  }
}
