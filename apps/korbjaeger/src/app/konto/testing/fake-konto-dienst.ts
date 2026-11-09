import { signal } from '@angular/core';
import type { AuswahlInhalt } from '../../auswahl/auswahl-dokument';
import { fakeAuswahl } from '../../auswahl/testing/fake-auswahl';
import type { NichtUebernommen } from '../../auswahl/zusammenfuehren';
import {
  AnmeldungAbgebrochen,
  OhneInternet,
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
  public loeschenOhneServer = false;
  public uebrig: NichtUebernommen = { teams: 0, kinder: 0 };
  /** Changes on the device not yet sent to the account (offline). */
  public nichtGesendet = false;
  /** Runs while the takeover runs, as an Elternteil changing the device meanwhile. */
  public waehrendUebernahme?: () => Promise<void>;
  public uebernommen?: AuswahlInhalt;
  /** What the account's selection told of its failure (`auswahl`'s `beiFehler`). */
  public lesefehler?: (fehler: unknown) => void;
  public readonly kontoAuswahl: KontoAuswahl = {
    ...fakeAuswahl(),
    nichtLesbar: signal(false),
    geladen: () => Promise.resolve(),
    beenden: () => this.aufrufe.push('beenden'),
  };
  private readonly zuhoerer: Array<(benutzer: Benutzer | null) => void> = [];

  /** Auth's Elternteil changes, as when another tab signs in or out. */
  public authMeldet(benutzer: Benutzer | null): void {
    this.zuhoerer.forEach((rueckruf) => rueckruf(benutzer));
  }

  public async angemeldet(): Promise<Benutzer | null> {
    this.aufrufe.push('angemeldet');
    return this.wiederhergestellt;
  }

  public beobachten(rueckruf: (benutzer: Benutzer | null) => void): () => void {
    this.zuhoerer.push(rueckruf);
    return () => undefined;
  }

  public async mitGoogleAnmelden(): Promise<Benutzer> {
    this.aufrufe.push('mitGoogleAnmelden');
    this.popupPruefen();
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
  }

  public async benutzerLoeschen(): Promise<void> {
    this.aufrufe.push('benutzerLoeschen');
  }

  public async auswahl(
    uid: string,
    beiFehler: (fehler: unknown) => void
  ): Promise<KontoAuswahl> {
    this.aufrufe.push(`auswahl ${uid}`);
    this.lesefehler = beiFehler;
    return this.kontoAuswahl;
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
    this.uebernommen = geraet;
    return this.uebrig;
  }

  public async auswahlLoeschen(uid: string): Promise<void> {
    this.aufrufe.push(`auswahlLoeschen ${uid}`);
    if (this.loeschenOhneServer) {
      throw new OhneInternet();
    }
  }

  public async allesGesendet(): Promise<boolean> {
    this.aufrufe.push('allesGesendet');
    return !this.nichtGesendet;
  }

  public async zwischenspeicherLeeren(): Promise<void> {
    this.aufrufe.push('zwischenspeicherLeeren');
  }

  private popupPruefen(): void {
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

  public constructor(public angemeldet = false) {}

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
