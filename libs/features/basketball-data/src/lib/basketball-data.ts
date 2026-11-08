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

/** What every read, and the transport under it, takes beside its ids. */
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
 * another adapter.
 */
export interface BasketballData {
  /** The search facets and the first page of Ligen for `filter`. */
  ligaSuche(filter: LigaSucheFilter, options?: ReadOptions): Promise<LigaSuche>;
  /** A later page of the Ligen for `filter`, from `startIndex` on. */
  ligaSeite(
    filter: LigaSucheFilter,
    startIndex: number,
    options?: ReadOptions
  ): Promise<LigaSeite>;
  /** The Teams of a Liga, by name. */
  ligaTeams(liga: LigaId, options?: ReadOptions): Promise<readonly Team[]>;
  /** The Teams seen in a Verein's Spiele of the last and next weeks. */
  vereinsTeams(verein: VereinId, options?: ReadOptions): Promise<VereinsTeams>;
  /** All Spiele of a Team in the Saison, across its Ligen, by date. */
  teamSpiele(team: TeamId, options?: ReadOptions): Promise<TeamSaison>;
  tabelle(liga: LigaId, options?: ReadOptions): Promise<Tabelle>;
  /** A Spiel's result, quarters and Halle. */
  spiel(spiel: SpielId, options?: ReadOptions): Promise<SpielDetails>;
  /** Both Kader of a Spiel, or `undefined` while there is no Spielbericht. */
  spielbericht(
    spiel: SpielId,
    options?: ReadOptions
  ): Promise<Spielbericht | undefined>;
}
