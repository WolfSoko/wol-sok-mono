import { computed, signal, type Signal } from '@angular/core';
import type { PersonId, TeamId } from '@wolsok/feat-shared-basketball-data';
import type { Auswahl } from '../auswahl/auswahl';
import type { Kind, MarkierbarerSpieler } from '../auswahl/kind';
import type { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import {
  ErneuteAnmeldungNoetig,
  type Benutzer,
  type KontoAuswahl,
  type KontoDienst,
} from './konto-dienst';

/**
 * Where the account stands, for the settings:
 * - `aus`: this build offers no sign-in (`environment.anmeldung`).
 * - `abgemeldet`: Meine Teams and Kinder are on the device.
 * - `laedt`: the account of an Elternteil signed in before is opening.
 * - `angemeldet`: they are the account's, `name` from Google, in memory.
 * - `nicht-erreichbar`: the account could not be opened.
 */
export type KontoStand =
  | { readonly art: 'aus' }
  | { readonly art: 'abgemeldet' }
  | { readonly art: 'laedt' }
  | { readonly art: 'angemeldet'; readonly name: string | null }
  | { readonly art: 'nicht-erreichbar' };

/** Remembers on the device that an Elternteil is signed in. */
export interface AnmeldeMerker {
  gesetzt(): boolean;
  setzen(): void;
  loeschen(): void;
}

/**
 * The account of an Elternteil and the `Auswahl` that goes with it: the
 * device's (`LokaleAuswahl`) signed out, the account's (`KontoAuswahl`)
 * signed in. Firebase is loaded (`laden`) only to sign in or to open the
 * account of an Elternteil signed in before (`merker`), so a visitor
 * without an account never contacts Google.
 */
export class KontoSitzung {
  public readonly stand: Signal<KontoStand>;
  /** The screens' `Auswahl`: whichever holds Meine Teams and Kinder now. */
  public readonly auswahl: Auswahl;

  private readonly zustand = signal<KontoStand>({ art: 'aus' });
  private readonly aktuell = signal<Auswahl | undefined>(undefined);
  private dienst?: KontoDienst;
  private konto?: {
    readonly benutzer: Benutzer;
    readonly auswahl: KontoAuswahl;
  };

  /**
   * @param laden loads Firebase; `undefined` where this build offers no
   *   sign-in.
   */
  public constructor(
    private readonly lokal: LokaleAuswahl,
    private readonly laden: (() => Promise<KontoDienst>) | undefined,
    private readonly merker: AnmeldeMerker
  ) {
    this.stand = this.zustand.asReadonly();
    this.auswahl = new AktuelleAuswahl(this.aktuell);
  }

  /** Opens the account of an Elternteil signed in before, or the device's. */
  public async starten(): Promise<void> {
    if (this.laden === undefined || !this.merker.gesetzt()) {
      this.aufDemGeraet(this.laden === undefined ? 'aus' : 'abgemeldet');
      return;
    }
    this.zustand.set({ art: 'laedt' });
    try {
      const dienst = await this.dienstHolen();
      const benutzer = await dienst.angemeldet();
      if (benutzer === null) {
        this.merker.loeschen();
        this.aufDemGeraet('abgemeldet');
        return;
      }
      this.oeffnen(dienst, benutzer);
    } catch {
      // the account's choices stay unshown rather than the device's
      this.zustand.set({ art: 'nicht-erreichbar' });
    }
  }

  /**
   * Signs in with Google and takes the device's choices into the account,
   * then off the device. Rejects with `AnmeldungAbgebrochen` when the popup
   * was closed; where the choices could not be taken over, it signs out
   * again and rejects, the device's choices kept.
   */
  public async anmelden(): Promise<void> {
    const dienst = await this.dienstHolen();
    const benutzer = await dienst.mitGoogleAnmelden();
    try {
      await dienst.geraetUebernehmen(benutzer.uid, {
        teams: this.lokal.teams(),
        kinder: this.lokal.kinder(),
      });
    } catch (fehler) {
      await dienst.abmelden();
      throw fehler;
    }
    this.lokal.leeren();
    this.merker.setzen();
    this.oeffnen(dienst, benutzer);
  }

  /** Signs out: the account's choices leave the device, the device's start empty. */
  public async abmelden(): Promise<void> {
    const dienst = this.dienst;
    if (dienst === undefined || this.konto === undefined) {
      return;
    }
    this.konto.auswahl.beenden();
    await dienst.abmelden();
    await this.vomGeraetNehmen(dienst);
  }

  /**
   * Deletes the account: its document first, then the account itself,
   * asking Google once more where Auth wants a fresh sign-in for it.
   */
  public async loeschen(): Promise<void> {
    const dienst = this.dienst;
    if (dienst === undefined || this.konto === undefined) {
      return;
    }
    await dienst.auswahlLoeschen(this.konto.benutzer.uid);
    try {
      await dienst.benutzerLoeschen();
    } catch (fehler) {
      if (!(fehler instanceof ErneuteAnmeldungNoetig)) {
        throw fehler;
      }
      await dienst.erneutAnmelden();
      await dienst.benutzerLoeschen();
    }
    this.konto.auswahl.beenden();
    await this.vomGeraetNehmen(dienst);
  }

  private async dienstHolen(): Promise<KontoDienst> {
    if (this.laden === undefined) {
      throw new Error('Diese Version bietet keine Anmeldung.');
    }
    this.dienst ??= await this.laden();
    return this.dienst;
  }

  private oeffnen(dienst: KontoDienst, benutzer: Benutzer): void {
    const auswahl = dienst.auswahl(benutzer.uid);
    this.konto = { benutzer, auswahl };
    this.aktuell.set(auswahl);
    this.zustand.set({ art: 'angemeldet', name: benutzer.name });
  }

  /** After signing out or deleting: nothing of the account stays. */
  private async vomGeraetNehmen(dienst: KontoDienst): Promise<void> {
    this.konto = undefined;
    this.merker.loeschen();
    this.lokal.leeren();
    this.aufDemGeraet('abgemeldet');
    await dienst.zwischenspeicherLeeren();
  }

  private aufDemGeraet(art: 'aus' | 'abgemeldet'): void {
    this.aktuell.set(this.lokal);
    this.zustand.set({ art });
  }
}

/** The `Auswahl` that holds the choices now; nothing while none does yet. */
class AktuelleAuswahl implements Auswahl {
  public readonly teams: Signal<readonly TeamId[] | undefined>;
  public readonly kinder: Signal<readonly Kind[] | undefined>;

  public constructor(private readonly aktuell: Signal<Auswahl | undefined>) {
    this.teams = computed(() => aktuell()?.teams());
    this.kinder = computed(() => aktuell()?.kinder());
  }

  public folgen(team: TeamId): Promise<void> {
    return this.mit((auswahl) => auswahl.folgen(team));
  }

  public entfolgen(team: TeamId): Promise<void> {
    return this.mit((auswahl) => auswahl.entfolgen(team));
  }

  public markieren(
    spieler: MarkierbarerSpieler,
    spitzname?: string
  ): Promise<void> {
    return this.mit((auswahl) => auswahl.markieren(spieler, spitzname));
  }

  public spitznameSetzen(
    person: PersonId,
    spitzname: string | undefined
  ): Promise<void> {
    return this.mit((auswahl) => auswahl.spitznameSetzen(person, spitzname));
  }

  public entmarkieren(person: PersonId): Promise<void> {
    return this.mit((auswahl) => auswahl.entmarkieren(person));
  }

  /** Changes only once `teams` is read, as `Auswahl` asks. */
  private mit(aendern: (auswahl: Auswahl) => Promise<void>): Promise<void> {
    const auswahl = this.aktuell();
    return auswahl === undefined
      ? Promise.reject(new Error('Meine Teams sind noch nicht gelesen.'))
      : aendern(auswahl);
  }
}
