import type { LigaId, SpielId, TeamId, VereinId } from './domain/ids';
import type {
  LigaSeite,
  LigaSuche,
  LigaSucheFilter,
} from './domain/liga-suche';
import type { SpielDetails } from './domain/spiel';
import type { Spielbericht } from './domain/spielbericht';
import type { Tabelle } from './domain/tabelle';
import type { Team } from './domain/team';
import type { TeamSaison, VereinsTeams } from './domain/team-saison';

/**
 * The part of an `AbortSignal` a read uses. A browser's or Node's
 * `AbortSignal` is one; the lib compiles without either's types.
 */
export interface ReadSignal {
  readonly aborted: boolean;
  readonly reason: unknown;
  throwIfAborted(): void;
  addEventListener(
    type: 'abort',
    listener: () => void,
    options?: { readonly once?: boolean }
  ): void;
}

/**
 * What every read, and the transport under it, takes beside its ids. An
 * app may widen it with fields its transport reads (`BasketballData<O>`,
 * `DbbTransport<O>`): a read hands its options to the transport as they
 * are.
 */
export interface ReadOptions {
  /** Cancels the read: it then rejects with the signal's reason. */
  readonly signal?: ReadSignal;
}

/**
 * The basketball data the app reads, in domain terms. Every read rejects
 * with a `BasketballDataError` only: `not-found`, `offline` (a transport
 * that knows the reader's network is down), `unavailable` or
 * `unexpected-shape`; a cancelled one with its signal's reason.
 * `DbbBasketballData` reads it from the DBB; an official source would be
 * another adapter. `O`: the options its reads take.
 */
export interface BasketballData<O extends ReadOptions = ReadOptions> {
  /** The search facets and the first page of Ligen for `filter`. */
  ligaSuche(filter: LigaSucheFilter, options?: O): Promise<LigaSuche>;
  /** A later page of the Ligen for `filter`, from `startIndex` on. */
  ligaSeite(
    filter: LigaSucheFilter,
    startIndex: number,
    options?: O
  ): Promise<LigaSeite>;
  /** The Teams of a Liga, by name. */
  ligaTeams(liga: LigaId, options?: O): Promise<readonly Team[]>;
  /** The Teams seen in a Verein's Spiele of the last and next weeks. */
  vereinsTeams(verein: VereinId, options?: O): Promise<VereinsTeams>;
  /** All Spiele of a Team in the Saison, across its Ligen, by date. */
  teamSpiele(team: TeamId, options?: O): Promise<TeamSaison>;
  tabelle(liga: LigaId, options?: O): Promise<Tabelle>;
  /** A Spiel's result, quarters and Halle. */
  spiel(spiel: SpielId, options?: O): Promise<SpielDetails>;
  /** Both Kader of a Spiel, or `undefined` while there is no Spielbericht. */
  spielbericht(spiel: SpielId, options?: O): Promise<Spielbericht | undefined>;
}
