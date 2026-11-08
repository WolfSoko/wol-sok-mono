import { signal, type Signal } from '@angular/core';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import type { Auswahl } from './auswahl';
import {
  auswahlDokumentLesen,
  auswahlDokumentMit,
  type GelesenesDokument,
} from './auswahl-dokument';
import { istSpeicherVoll } from '../geraete-speicher';
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
 * The `Auswahl` on the device, for Elternteile without an account.
 * - It reads the stored `AuswahlDokument` at start, whenever another tab
 *   changed it (the `storage` event on `fenster`, until `beenden`), and
 *   again before each write, so two tabs keep each other's changes.
 * - A document that cannot be read or is none counts as empty; fields it
 *   does not know are kept on a write.
 * - A document of a newer version is left alone: no Team is followed, and
 *   `folgen` and `entfolgen` reject with `AuswahlZuNeuError`.
 * - Where the storage is full, it has `platzSchaffen` free it (of the
 *   cached DBB answers) and tries once more. Where it still takes nothing
 *   (private mode, full), Meine Teams last for this visit only.
 */
export class LokaleAuswahl implements Auswahl {
  public readonly teams: Signal<readonly TeamId[]>;

  private readonly gefolgt;

  private readonly beiAenderung = (event: Event): void => {
    if (
      event instanceof StorageEvent &&
      (event.key === null || event.key === AUSWAHL_SCHLUESSEL)
    ) {
      this.gefolgt.set(teamsAus(this.lesen()));
    }
  };

  /**
   * @param platzSchaffen frees the device's storage of what may give way
   *   (the cached DBB answers) when it is full; Meine Teams always win.
   */
  public constructor(
    private readonly speicher: GeraeteSpeicher | undefined,
    private readonly fenster?: Fenster,
    private readonly platzSchaffen: () => void = () => undefined
  ) {
    // read at once, so `teams` is never undefined here
    this.gefolgt = signal<readonly TeamId[]>(teamsAus(this.lesen()), {
      equal: gleicheTeams,
    });
    this.teams = this.gefolgt.asReadonly();
    fenster?.addEventListener('storage', this.beiAenderung);
  }

  public async folgen(team: TeamId): Promise<void> {
    this.aendern((teams) => (teams.includes(team) ? teams : [...teams, team]));
  }

  public async entfolgen(team: TeamId): Promise<void> {
    this.aendern((teams) =>
      teams.includes(team) ? teams.filter((id) => id !== team) : teams
    );
  }

  /** Stops listening to other tabs. */
  public beenden(): void {
    this.fenster?.removeEventListener('storage', this.beiAenderung);
  }

  /**
   * Applies `aenderung` to what is stored now and stores the result, if
   * it changed anything.
   */
  private aendern(
    aenderung: (teams: readonly TeamId[]) => readonly TeamId[]
  ): void {
    const gelesen = this.lesen();
    if (gelesen.art === 'neuer') {
      this.gefolgt.set([]);
      throw new AuswahlZuNeuError();
    }
    // where nothing could be read, what this visit followed stands
    const { teams: vorher, roh } =
      gelesen.art === 'aktuell' ? gelesen : { teams: this.gefolgt(), roh: {} };
    const nachher = aenderung(vorher);
    this.gefolgt.set(nachher);
    if (nachher !== vorher) {
      this.schreiben(auswahlDokumentMit(nachher, roh));
    }
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
    const text = JSON.stringify(dokument);
    try {
      this.speicher?.setItem(AUSWAHL_SCHLUESSEL, text);
    } catch (error) {
      if (istSpeicherVoll(error)) {
        this.nachPlatzSchreiben(text);
      }
      // blocked: Meine Teams last for this visit only
    }
  }

  /** Has the cached data give way, then tries once more. */
  private nachPlatzSchreiben(text: string): void {
    try {
      this.platzSchaffen();
      this.speicher?.setItem(AUSWAHL_SCHLUESSEL, text);
    } catch {
      // still full: Meine Teams last for this visit only
    }
  }
}

function teamsAus(gelesen: GelesenesDokument): readonly TeamId[] {
  return gelesen.art === 'aktuell' ? gelesen.teams : [];
}

function gleicheTeams(a: readonly TeamId[], b: readonly TeamId[]): boolean {
  return a.length === b.length && a.every((team, i) => team === b[i]);
}
