import { signal } from '@angular/core';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import {
  LEERE_AUSWAHL,
  type AuswahlInhalt,
} from '../../auswahl/auswahl-dokument';
import { fakeAuswahl } from '../../auswahl/testing/fake-auswahl';
import type { NichtUebernommen } from '../../auswahl/zusammenfuehren';
import {
  AnmeldungAbgebrochen,
  KontoGewechselt,
  type Benutzer,
  type KontoAuswahl,
  type KontoDienst,
} from '../konto-dienst';
import type { AnmeldeMerker } from '../konto-sitzung';

/** An invented account. */
export const MIMI_ELTERN: Benutzer = { uid: 'uid-1', name: 'Familie Muster' };

/**
 * A `KontoDienst` for specs: it logs its calls in order (`aufrufe`) and has
 * switches for its faults; the account's selection is a `fakeAuswahl`, and
 * `authMeldet` plays Auth telling of another tab's sign-in or sign-out.
 */
export class FakeKontoDienst implements KontoDienst {
  public readonly aufrufe: string[] = [];
  public wiederhergestellt: Benutzer | null = null;
  /** The popup is closed by the Elternteil. */
  public abgebrochen = false;
  /** The popup fails with this. */
  public popupFehler?: Error;
  public uebernahmeScheitert = false;
  public abmeldenScheitert = false;
  /** Holds the server's confirmation of the deleted document back until it resolves. */
  public loeschenBestaetigt?: Promise<void>;
  public uebrig: NichtUebernommen = LEERE_AUSWAHL;
  /** Opening an account's selection fails. */
  public auswahlScheitert = false;
  /** Auth refuses to delete the account (an old sign-in). */
  public benutzerLoeschenScheitert = false;
  /** Holds `zwischenspeicherLeeren` back until it resolves. */
  public zwischenspeicherBereit?: Promise<void>;
  /** Changes on the device not yet sent to the account (offline). */
  public nichtGesendet = false;
  /** Runs while the takeover runs, as an Elternteil changing the device meanwhile. */
  public waehrendUebernahme?: () => Promise<void>;
  /** Runs during every takeover, not just the next. */
  public beiJederUebernahme?: () => Promise<void>;
  /** Runs while a popup is open, as another tab acting meanwhile. */
  public waehrendPopup?: () => void;
  /** Holds `auswahl` back until it resolves. */
  public auswahlBereit?: Promise<void>;
  public uebernommen?: AuswahlInhalt;
  /** What the account's selection told of its failure (`auswahl`'s `beiFehler`). */
  public lesefehler?: (fehler: unknown) => void;
  /** The selection of `MIMI_ELTERN`'s account; others get their own (`auswahlVon`). */
  public readonly kontoAuswahl: KontoAuswahl = this.neueAuswahl();
  private readonly auswahlen = new Map<string, KontoAuswahl>([
    [MIMI_ELTERN.uid, this.kontoAuswahl],
  ]);
  private readonly zuhoerer: Array<(benutzer: Benutzer | null) => void> = [];

  /** Auth's Elternteil changes, as when another tab signs in or out. */
  public authMeldet(benutzer: Benutzer | null): void {
    this.wiederhergestellt = benutzer;
    this.zuhoerer.forEach((rueckruf) => rueckruf(benutzer));
  }

  public async angemeldet(): Promise<Benutzer | null> {
    this.aufrufe.push('angemeldet');
    return this.wiederhergestellt;
  }

  public jetzt(): Benutzer | null {
    return this.wiederhergestellt;
  }

  public beobachten(rueckruf: (benutzer: Benutzer | null) => void): () => void {
    this.zuhoerer.push(rueckruf);
    return () => undefined;
  }

  public async mitGoogleAnmelden(): Promise<Benutzer> {
    this.aufrufe.push('mitGoogleAnmelden');
    this.popupPruefen();
    this.wiederhergestellt = MIMI_ELTERN;
    return MIMI_ELTERN;
  }

  public async erneutAnmelden(): Promise<void> {
    this.aufrufe.push('erneutAnmelden');
    this.popupPruefen();
  }

  public async abmelden(): Promise<void> {
    this.aufrufe.push('abmelden');
    if (this.abmeldenScheitert) {
      throw new Error('Auth unreachable');
    }
    this.wiederhergestellt = null;
  }

  public async benutzerLoeschen(uid: string): Promise<void> {
    this.aufrufe.push(`benutzerLoeschen ${uid}`);
    if (this.benutzerLoeschenScheitert) {
      throw new Error('auth/requires-recent-login');
    }
    if (this.wiederhergestellt?.uid !== uid) {
      throw new KontoGewechselt();
    }
    this.wiederhergestellt = null;
  }

  /** The selection of the account `uid`, its own for each account. */
  public auswahlVon(uid: string): KontoAuswahl {
    const auswahl = this.auswahlen.get(uid) ?? this.neueAuswahl();
    this.auswahlen.set(uid, auswahl);
    return auswahl;
  }

  public async auswahl(
    uid: string,
    beiFehler: (fehler: unknown) => void
  ): Promise<KontoAuswahl> {
    this.aufrufe.push(`auswahl ${uid}`);
    await this.auswahlBereit;
    if (this.auswahlScheitert) {
      throw new Error('unavailable');
    }
    this.lesefehler = beiFehler;
    return this.auswahlVon(uid);
  }

  public async geraetUebernehmen(
    uid: string,
    geraet: AuswahlInhalt
  ): Promise<NichtUebernommen> {
    this.aufrufe.push(`geraetUebernehmen ${uid}`);
    if (this.uebernahmeScheitert) {
      throw new Error('offline');
    }
    const waehrend = this.waehrendUebernahme;
    this.waehrendUebernahme = undefined;
    await waehrend?.();
    await this.beiJederUebernahme?.();
    this.uebernommen = geraet;
    return this.uebrig;
  }

  public async auswahlLoeschen(uid: string): Promise<void> {
    this.aufrufe.push(`auswahlLoeschen ${uid}`);
    await this.loeschenBestaetigt;
  }

  public async allesGesendet(): Promise<boolean> {
    this.aufrufe.push('allesGesendet');
    return !this.nichtGesendet;
  }

  public async zwischenspeicherLeeren(): Promise<void> {
    this.aufrufe.push('zwischenspeicherLeeren');
    await this.zwischenspeicherBereit;
  }

  /** An account's selection: Teams followed stay; the rest as `fakeAuswahl`. */
  private neueAuswahl(): KontoAuswahl {
    const teams = signal<readonly TeamId[]>([]);
    return {
      ...fakeAuswahl({
        teams,
        folgen: async (team) => teams.update((alle) => [...alle, team]),
      }),
      nichtLesbar: signal(false),
      geladen: () => Promise.resolve(),
      beenden: () => this.aufrufe.push('beenden'),
    };
  }

  private popupPruefen(): void {
    this.waehrendPopup?.();
    if (this.abgebrochen) {
      throw new AnmeldungAbgebrochen();
    }
    if (this.popupFehler) {
      throw this.popupFehler;
    }
  }
}

/** An `AnmeldeMerker` in memory; `vonAnderemTab` plays another tab's change. */
export class MerkerImSpec implements AnmeldeMerker {
  private readonly zuhoerer: Array<() => void> = [];
  /** A sign-out left Firestore's copy on the device to clear. */
  public aufraeumen = false;

  public constructor(public angemeldet = false) {}

  public aufraeumenOffen(): boolean {
    return this.aufraeumen;
  }

  public gesetzt(): boolean {
    return this.angemeldet;
  }
  public setzen(): void {
    this.angemeldet = true;
  }
  public loeschen(): void {
    this.angemeldet = false;
  }

  public beobachten(rueckruf: () => void): () => void {
    this.zuhoerer.push(rueckruf);
    return () => undefined;
  }

  public vonAnderemTab(angemeldet: boolean): void {
    this.angemeldet = angemeldet;
    this.zuhoerer.forEach((rueckruf) => rueckruf());
  }
}
