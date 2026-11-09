import type { AuswahlInhalt } from '../../auswahl/auswahl-dokument';
import { fakeAuswahl } from '../../auswahl/testing/fake-auswahl';
import {
  AnmeldungAbgebrochen,
  ErneuteAnmeldungNoetig,
  type Benutzer,
  type KontoAuswahl,
  type KontoDienst,
} from '../konto-dienst';
import type { AnmeldeMerker } from '../konto-sitzung';

/** An invented account. */
export const MIMI_ELTERN: Benutzer = { uid: 'uid-1', name: 'Familie Muster' };

/**
 * A `KontoDienst` for specs: it logs its calls in order (`aufrufe`) and has
 * switches for its faults; the account's selection is a `fakeAuswahl`.
 */
export class FakeKontoDienst implements KontoDienst {
  public readonly aufrufe: string[] = [];
  public wiederhergestellt: Benutzer | null = null;
  public abgebrochen = false;
  public uebernahmeScheitert = false;
  public frischAnmelden = false;
  public uebernommen?: AuswahlInhalt;
  public readonly kontoAuswahl: KontoAuswahl = {
    ...fakeAuswahl(),
    geladen: () => Promise.resolve(),
    beenden: () => this.aufrufe.push('beenden'),
  };

  public async angemeldet(): Promise<Benutzer | null> {
    this.aufrufe.push('angemeldet');
    return this.wiederhergestellt;
  }

  public async mitGoogleAnmelden(): Promise<Benutzer> {
    this.aufrufe.push('mitGoogleAnmelden');
    if (this.abgebrochen) {
      throw new AnmeldungAbgebrochen();
    }
    return MIMI_ELTERN;
  }

  public async erneutAnmelden(): Promise<void> {
    this.aufrufe.push('erneutAnmelden');
    if (this.abgebrochen) {
      throw new AnmeldungAbgebrochen();
    }
    this.frischAnmelden = false;
  }

  public async abmelden(): Promise<void> {
    this.aufrufe.push('abmelden');
  }

  public async benutzerLoeschen(): Promise<void> {
    this.aufrufe.push('benutzerLoeschen');
    if (this.frischAnmelden) {
      throw new ErneuteAnmeldungNoetig();
    }
  }

  public auswahl(uid: string): KontoAuswahl {
    this.aufrufe.push(`auswahl ${uid}`);
    return this.kontoAuswahl;
  }

  public async geraetUebernehmen(
    uid: string,
    geraet: AuswahlInhalt
  ): Promise<void> {
    this.aufrufe.push(`geraetUebernehmen ${uid}`);
    if (this.uebernahmeScheitert) {
      throw new Error('offline');
    }
    this.uebernommen = geraet;
  }

  public async auswahlLoeschen(uid: string): Promise<void> {
    this.aufrufe.push(`auswahlLoeschen ${uid}`);
  }

  public async zwischenspeicherLeeren(): Promise<void> {
    this.aufrufe.push('zwischenspeicherLeeren');
  }
}

/** An `AnmeldeMerker` in memory. */
export class MerkerImSpec implements AnmeldeMerker {
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
}
