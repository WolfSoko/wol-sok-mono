import { InjectionToken, type Signal } from '@angular/core';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { geraeteSpeicher, LokaleAuswahl } from './lokale-auswahl';

/**
 * What an Elternteil follows: Meine Teams (Kinder join in Ticket 6). Kept
 * on the device by `LokaleAuswahl`; a Firestore adapter for signed-in
 * Elternteile follows (Ticket 8). Every adapter passes the shared
 * contract, `auswahlVertrag` (`testing/auswahl-vertrag.ts`).
 */
export interface Auswahl {
  /** Meine Teams, in the order they were followed, each once. */
  readonly teams: Signal<readonly TeamId[]>;
  /**
   * Adds `team` to the end of Meine Teams, unless it is in them already.
   * Resolves once stored; rejects where the adapter could not store it.
   */
  folgen(team: TeamId): Promise<void>;
  /** Takes `team` out of Meine Teams, if it is in them. */
  entfolgen(team: TeamId): Promise<void>;
}

/** The screens' `Auswahl`: on the device, for now. */
export const AUSWAHL = new InjectionToken<Auswahl>('Auswahl', {
  providedIn: 'root',
  factory: () => new LokaleAuswahl(geraeteSpeicher()),
});
