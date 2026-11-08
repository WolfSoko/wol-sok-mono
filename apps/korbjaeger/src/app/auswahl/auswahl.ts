import {
  DestroyRef,
  DOCUMENT,
  inject,
  InjectionToken,
  type Signal,
} from '@angular/core';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { geraeteSpeicher } from '../geraete-speicher';
import { LokaleAuswahl } from './lokale-auswahl';

/**
 * What an Elternteil follows: Meine Teams (Kinder join with #2872). Kept
 * on the device by `LokaleAuswahl`; a Firestore adapter for signed-in
 * Elternteile follows with #2873. Every adapter passes the shared
 * contract, `auswahlVertrag` (`testing/auswahl-vertrag.ts`).
 *
 * Errors: a change shows in `teams` once its promise resolves. Where an
 * adapter cannot store it lastingly (the device's storage full or
 * blocked), the change still holds for this visit and the promise
 * resolves. Where a newer version of the app stored the selection, the
 * adapter leaves it untouched: `teams` is empty and every change rejects
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
   * Adds `team` to the end of Meine Teams, unless it is in them already.
   * Only once `teams` is read.
   */
  folgen(team: TeamId): Promise<void>;
  /** Takes `team` out of Meine Teams, if it is in them. */
  entfolgen(team: TeamId): Promise<void>;
}

/** The screens' `Auswahl`: on the device, for now. */
export const AUSWAHL = new InjectionToken<Auswahl>('Auswahl', {
  providedIn: 'root',
  factory: () => {
    const auswahl = new LokaleAuswahl(
      geraeteSpeicher(),
      inject(DOCUMENT).defaultView ?? undefined
    );
    inject(DestroyRef).onDestroy(() => auswahl.beenden());
    return auswahl;
  },
});
