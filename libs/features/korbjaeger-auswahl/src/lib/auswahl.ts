import type { Signal } from '@angular/core';
import type {
  PersonId,
  TeamId,
  VereinId,
} from '@wolsok/feat-shared-basketball-data';
import type { Vereinsfarben } from './vereinsfarben';
import type { VereinsfarbenWahl } from './vereinsfarben-wahl';
import type { Kind, MarkierbarerSpieler } from './kind';
import type { TeamPlatz } from './auswahl-dokument';

/**
 * What an Elternteil follows: Meine Teams and the Kinder they marked, and
 * the colours they gave Vereine (#2918). Kept
 * on the device by `LokaleAuswahl`, in the account of a signed-in
 * Elternteil by `FirestoreAuswahl`. Every adapter passes the shared
 * contract, `auswahlVertrag` (`testing/auswahl-vertrag.ts`).
 *
 * Errors: a change shows in `teams` or `kinder` once its promise resolves. Where an
 * adapter cannot store it lastingly (the device's storage full or
 * blocked), the change still holds for this visit and the promise
 * resolves. Where a newer version of the app stored the selection, the
 * adapter leaves it untouched: `teams` and `kinder` are empty and every
 * change rejects
 * with `AuswahlZuNeuError` (`auswahl-fehler.ts`).
 */
export interface Auswahl {
  /**
   * Meine Teams, in the order they were followed, each once; `undefined`
   * until the adapter has read them, so no screen takes "not read yet"
   * for "none".
   */
  readonly teams: Signal<readonly TeamId[] | undefined>;
  /**
   * Whether the selection cannot be read (the account's, its listener
   * failed): `teams` and `kinder` then stay `undefined`, and screens say so
   * rather than wait.
   */
  readonly nichtLesbar: Signal<boolean>;
  /**
   * Which store holds the choices now: the same value while one does, a
   * new one once the device's and an account's take turns (a sign-in or
   * sign-out, here or in another tab). An undo offered for a change keeps
   * to the store it was made in.
   */
  readonly quelle: Signal<unknown>;
  /**
   * Adds `team` to Meine Teams, unless it is in them already: at `platz`,
   * the place `entfolgen` gave for it (an undo), else at the end. Only once
   * `teams` is read.
   */
  folgen(team: TeamId, platz?: TeamPlatz): Promise<void>;
  /**
   * Takes `team` out of Meine Teams, if it is in them; resolves with the
   * place it had, for `folgen` to put it back there, or `undefined` where
   * it was not followed.
   */
  entfolgen(team: TeamId): Promise<TeamPlatz | undefined>;
  /**
   * The marked Kinder, in the order they were marked, each person once;
   * `undefined` until the adapter has read them. A Spitzname is trimmed
   * and at most `SPITZNAME_LAENGE` characters (`spitznameAus`).
   */
  readonly kinder: Signal<readonly Kind[] | undefined>;
  /**
   * Marks `spieler`, a named player, as a Kind with `spitzname`, at the end
   * of the Kinder; a Kind marked already stays as it is. Only once
   * `kinder` is read.
   */
  markieren(spieler: MarkierbarerSpieler, spitzname?: string): Promise<void>;
  /**
   * Gives the Kind `person` the Spitzname `spitzname`, or none; ignored for
   * a person not marked.
   */
  spitznameSetzen(
    person: PersonId,
    spitzname: string | undefined
  ): Promise<void>;
  /** Unmarks the Kind `person`, if it is marked. */
  entmarkieren(person: PersonId): Promise<void>;
  /**
   * The colours given to Vereine, one entry a Verein, by its id;
   * `undefined` until the adapter has read them. A Verein without an entry
   * shows the app's own colours.
   */
  readonly vereinsfarben: Signal<readonly VereinsfarbenWahl[] | undefined>;
  /**
   * Gives `verein` the colours `farben`, in place of any it has; each is
   * stored in lower case, and what is no `#rrggbb` rejects with
   * `KeineFarbeError`. Only once `vereinsfarben` is read.
   */
  vereinsfarbenSetzen(verein: VereinId, farben: Vereinsfarben): Promise<void>;
  /** Takes the colours of `verein` away, if it has any. */
  vereinsfarbenZuruecksetzen(verein: VereinId): Promise<void>;
}
