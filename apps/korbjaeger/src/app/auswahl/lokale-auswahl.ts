import { signal, type Signal } from '@angular/core';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import type { Auswahl } from './auswahl';
import {
  AUSWAHL_VERSION,
  auswahlDokumentAus,
  type AuswahlDokument,
} from './auswahl-dokument';

/** The key of the `AuswahlDokument` in the device's storage. */
export const AUSWAHL_SCHLUESSEL = 'korbjaeger-auswahl';

/** The part of the device's storage (`localStorage`) the adapter uses. */
export type GeraeteSpeicher = Pick<Storage, 'getItem' | 'setItem'>;

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
 * The `Auswahl` on the device, for Elternteile without an account. Reads
 * the stored `AuswahlDokument` once; one that cannot be read or is none
 * counts as empty. Where the storage takes nothing (private mode, full),
 * Meine Teams last for this visit only: it never rejects.
 */
export class LokaleAuswahl implements Auswahl {
  public readonly teams: Signal<readonly TeamId[]>;

  private readonly gefolgt;

  public constructor(private readonly speicher: GeraeteSpeicher | undefined) {
    this.gefolgt = signal<readonly TeamId[]>(this.gespeichert()?.teams ?? []);
    this.teams = this.gefolgt.asReadonly();
  }

  public async folgen(team: TeamId): Promise<void> {
    if (!this.gefolgt().includes(team)) {
      this.speichern([...this.gefolgt(), team]);
    }
  }

  public async entfolgen(team: TeamId): Promise<void> {
    if (this.gefolgt().includes(team)) {
      this.speichern(this.gefolgt().filter((id) => id !== team));
    }
  }

  private gespeichert(): AuswahlDokument | undefined {
    try {
      const text = this.speicher?.getItem(AUSWAHL_SCHLUESSEL);
      return text ? auswahlDokumentAus(JSON.parse(text)) : undefined;
    } catch {
      return undefined;
    }
  }

  private speichern(teams: readonly TeamId[]): void {
    this.gefolgt.set(teams);
    const dokument: AuswahlDokument = { version: AUSWAHL_VERSION, teams };
    try {
      this.speicher?.setItem(AUSWAHL_SCHLUESSEL, JSON.stringify(dokument));
    } catch {
      // storage full or blocked: Meine Teams last for this visit only
    }
  }
}
