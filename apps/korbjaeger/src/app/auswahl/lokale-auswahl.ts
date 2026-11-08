import { signal, type Signal } from '@angular/core';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import type { Auswahl } from './auswahl';
import {
  auswahlDokumentLesen,
  auswahlDokumentMit,
  type GelesenesDokument,
} from './auswahl-dokument';
import { AuswahlZuNeuError } from './auswahl-fehler';

/** The key of the `AuswahlDokument` in the device's storage. */
export const AUSWAHL_SCHLUESSEL = 'korbjaeger-auswahl';

/** The part of the device's storage (`localStorage`) the adapter uses. */
export type GeraeteSpeicher = Pick<Storage, 'getItem' | 'setItem'>;

/** Where the browser tells of changes other tabs made (`window`). */
export type Fenster = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

/**
 * The device's `localStorage`, or `undefined` where the browser withholds
 * it (blocked site data may throw on the mere access).
 */
export function geraeteSpeicher(): GeraeteSpeicher | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * The `Auswahl` on the device, for Elternteile without an account.
 * - It reads the stored `AuswahlDokument` at start, whenever another tab
 *   changed it (the `storage` event on `fenster`, until `beenden`), and
 *   again before each write, so two tabs keep each other's changes.
 * - A document that cannot be read or is none counts as empty; fields it
 *   does not know are kept on a write.
 * - A document of a newer version is left alone: no Team is followed, and
 *   `folgen` and `entfolgen` reject with `AuswahlZuNeuError`.
 * - Where the storage takes nothing (private mode, full), Meine Teams
 *   last for this visit only.
 */
export class LokaleAuswahl implements Auswahl {
  public readonly teams: Signal<readonly TeamId[]>;

  private readonly gefolgt;

  private readonly beiAenderung = (event: Event): void => {
    if (
      event instanceof StorageEvent &&
      (event.key === null || event.key === AUSWAHL_SCHLUESSEL)
    ) {
      this.uebernehmen(this.lesen());
    }
  };

  public constructor(
    private readonly speicher: GeraeteSpeicher | undefined,
    private readonly fenster?: Fenster
  ) {
    this.gefolgt = signal<readonly TeamId[]>(teamsAus(this.lesen()));
    this.teams = this.gefolgt.asReadonly();
    fenster?.addEventListener('storage', this.beiAenderung);
  }

  public async folgen(team: TeamId): Promise<void> {
    this.aendern((teams) => (teams.includes(team) ? teams : [...teams, team]));
  }

  public async entfolgen(team: TeamId): Promise<void> {
    this.aendern((teams) => teams.filter((id) => id !== team));
  }

  /** Stops listening to other tabs. */
  public beenden(): void {
    this.fenster?.removeEventListener('storage', this.beiAenderung);
  }

  /** Applies `aenderung` to what is stored now, and stores the result. */
  private aendern(
    aenderung: (teams: readonly TeamId[]) => readonly TeamId[]
  ): void {
    const gelesen = this.lesen();
    if (gelesen.art === 'neuer') {
      this.uebernehmen(gelesen);
      throw new AuswahlZuNeuError();
    }
    // where nothing could be read, what this visit followed stands
    const vorher =
      gelesen.art === 'aktuell' ? gelesen.dokument.teams : this.gefolgt();
    const nachher = aenderung(vorher);
    this.gefolgt.set(nachher);
    if (nachher !== vorher) {
      this.schreiben(
        auswahlDokumentMit(
          nachher,
          gelesen.art === 'aktuell' ? gelesen.roh : undefined
        )
      );
    }
  }

  private uebernehmen(gelesen: GelesenesDokument): void {
    this.gefolgt.set(teamsAus(gelesen));
  }

  private lesen(): GelesenesDokument {
    try {
      const text = this.speicher?.getItem(AUSWAHL_SCHLUESSEL);
      return auswahlDokumentLesen(text ? JSON.parse(text) : undefined);
    } catch {
      return { art: 'keins' };
    }
  }

  private schreiben(dokument: unknown): void {
    try {
      this.speicher?.setItem(AUSWAHL_SCHLUESSEL, JSON.stringify(dokument));
    } catch {
      // storage full or blocked: Meine Teams last for this visit only
    }
  }
}

function teamsAus(gelesen: GelesenesDokument): readonly TeamId[] {
  return gelesen.art === 'aktuell' ? gelesen.dokument.teams : [];
}
