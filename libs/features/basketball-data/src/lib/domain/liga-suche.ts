import type {
  AltersgruppeGeschlechtId,
  AltersklasseId,
  VerbandId,
} from './ids';
import type { Liga } from './liga';

/** What the Liga search narrows to; an empty list narrows nothing. */
export interface LigaSucheFilter {
  readonly verbandIds: readonly VerbandId[];
  readonly altersklasseIds: readonly AltersklasseId[];
  readonly altersgruppeGeschlechtIds: readonly AltersgruppeGeschlechtId[];
}

/** One choice of a search facet, with how many Ligen it leaves. */
export interface Facette<Id> {
  readonly id: Id;
  readonly name: string;
  readonly treffer: number;
}

/** The facets the Liga search offers for the current filter. */
export interface LigaSucheFacetten {
  readonly verbaende: readonly Facette<VerbandId>[];
  readonly altersklassen: readonly Facette<AltersklasseId>[];
  /** Named like `Jugend männlich`. */
  readonly altersgruppenGeschlechter: readonly Facette<AltersgruppeGeschlechtId>[];
}

/** One page of the Ligen a filter finds. */
export interface LigaSeite {
  readonly startIndex: number;
  readonly ligen: readonly Liga[];
  /** Whether a page after this one exists (at `startIndex + ligen.length`). */
  readonly weitere: boolean;
}

/** The facets and the first page of Ligen for a filter. */
export interface LigaSuche {
  readonly facetten: LigaSucheFacetten;
  readonly ersteSeite: LigaSeite;
}

/** A filter that narrows nothing. */
export const KEIN_LIGA_FILTER: LigaSucheFilter = {
  verbandIds: [],
  altersklasseIds: [],
  altersgruppeGeschlechtIds: [],
};
