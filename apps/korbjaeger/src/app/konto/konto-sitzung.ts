import { computed, signal, type Signal } from '@angular/core';
import type { PersonId, TeamId } from '@wolsok/feat-shared-basketball-data';
import type { Auswahl } from '../auswahl/auswahl';
import type { Kind, MarkierbarerSpieler } from '../auswahl/kind';
import type { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import type { NichtUebernommen } from '../auswahl/zusammenfuehren';
import {
  OhneInternet,
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
 * - `nicht-erreichbar`: the account could not be opened or read.
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
  /** Calls `rueckruf` when another tab sets or clears it; returns how to stop. */
  beobachten(rueckruf: () => void): () => void;
}

/** Firestore's code for a read the rules refuse: the account is gone here. */
const NICHT_ERLAUBT = 'permission-denied';

/**
 * The account of an Elternteil and the `Auswahl` that goes with it: the
 * device's (`LokaleAuswahl`) signed out, the account's (`KontoAuswahl`)
 * signed in. Firebase is loaded (`laden`) only to sign in (`vorbereiten`,
 * once the settings open) or to open the account of an Elternteil signed
 * in before (`merker`), so a visitor without an account never contacts
 * Google. Every tab follows a sign-in or sign-out in another: through
 * Auth's state once Firebase is loaded, through the `merker` before.
 */
export class KontoSitzung {
  public readonly stand: Signal<KontoStand>;
  /** The screens' `Auswahl`: whichever holds Meine Teams and Kinder now. */
  public readonly auswahl: Auswahl;

  private readonly zustand = signal<KontoStand>({ art: 'aus' });
  private readonly aktuell = signal<Auswahl | undefined>(undefined);
  private dienst?: KontoDienst;
  private dienstLaden?: Promise<KontoDienst>;
  private konto?: {
    readonly benutzer: Benutzer;
    readonly auswahl: KontoAuswahl;
  };
  /** Set while this tab signs in, out or deletes: Auth's news is its own then. */
  private eigenerSchritt = false;

  /**
   * @param laden loads Firebase; `undefined` where this build offers no
   *   sign-in.
   * @param istOnline whether the device has a network (`navigator.onLine`).
   */
  public constructor(
    private readonly lokal: LokaleAuswahl,
    private readonly laden: (() => Promise<KontoDienst>) | undefined,
    private readonly merker: AnmeldeMerker,
    private readonly istOnline: () => boolean = () =>
      globalThis.navigator?.onLine ?? true
  ) {
    this.stand = this.zustand.asReadonly();
    this.auswahl = new AktuelleAuswahl(
      this.aktuell,
      computed(() => this.zustand().art === 'nicht-erreichbar')
    );
  }

  /**
   * Opens the account of an Elternteil signed in before, or the device's;
   * from then on follows the `merker` other tabs set or clear.
   */
  public async starten(): Promise<void> {
    if (this.laden === undefined) {
      this.aufDemGeraet('aus');
      return;
    }
    this.merker.beobachten(() => void this.merkerGeaendert());
    if (!this.merker.gesetzt()) {
      this.aufDemGeraet('abgemeldet');
      return;
    }
    await this.wiederOeffnen();
  }

  /**
   * Loads Firebase ahead, so a click on "sign in" opens Google's popup at
   * once: browsers (Safari) block one opened after waiting for a download.
   */
  public async vorbereiten(): Promise<void> {
    await this.dienstHolen();
  }

  /**
   * Signs in with Google and takes the device's choices into the account,
   * then off the device; resolves with what did not fit under the caps.
   * Rejects with `AnmeldungAbgebrochen` when the popup was closed,
   * `PopupBlockiert` when the browser refused it; where the choices could
   * not be taken over, it signs out again and rejects with that failure,
   * the device's choices kept.
   */
  public async anmelden(): Promise<NichtUebernommen> {
    this.eigenerSchritt = true;
    try {
      const dienst = this.dienst ?? (await this.dienstHolen());
      const benutzer = await dienst.mitGoogleAnmelden();
      let uebrig: NichtUebernommen;
      try {
        uebrig = await dienst.geraetUebernehmen(benutzer.uid, {
          teams: this.lokal.teams(),
          kinder: this.lokal.kinder(),
        });
      } catch (fehler) {
        // the failure to report is the takeover's, whatever signing out does
        await dienst.abmelden().catch(() => undefined);
        throw fehler;
      }
      this.lokal.leeren();
      this.merker.setzen();
      await this.oeffnen(dienst, benutzer);
      return uebrig;
    } finally {
      this.eigenerSchritt = false;
    }
  }

  /**
   * Signs out: the account's choices leave the device, the device's start
   * empty. Where Auth does not sign out, nothing changes.
   */
  public async abmelden(): Promise<void> {
    const { dienst, konto } = this;
    if (dienst === undefined || konto === undefined) {
      return;
    }
    this.eigenerSchritt = true;
    try {
      await dienst.abmelden();
      await this.vomGeraetNehmen(dienst);
    } finally {
      this.eigenerSchritt = false;
    }
  }

  /**
   * Deletes the account: asks Google first (Auth deletes an account only
   * shortly after a sign-in), so nothing is deleted where the Elternteil
   * cancels; then its document, which only a server can confirm (refused
   * offline with `OhneInternet`), then the account itself. Call it in the
   * click: the popup opens at once.
   */
  public async loeschen(): Promise<void> {
    const { dienst, konto } = this;
    if (dienst === undefined || konto === undefined) {
      return;
    }
    if (!this.istOnline()) {
      throw new OhneInternet();
    }
    this.eigenerSchritt = true;
    try {
      await dienst.erneutAnmelden();
      await dienst.auswahlLoeschen(konto.benutzer.uid);
      await dienst.benutzerLoeschen();
      await this.vomGeraetNehmen(dienst);
    } finally {
      this.eigenerSchritt = false;
    }
  }

  private async wiederOeffnen(): Promise<void> {
    this.zustand.set({ art: 'laedt' });
    this.aktuell.set(undefined);
    try {
      const dienst = await this.dienstHolen();
      const benutzer = await dienst.angemeldet();
      if (benutzer === null) {
        this.merker.loeschen();
        this.aufDemGeraet('abgemeldet');
        return;
      }
      await this.oeffnen(dienst, benutzer);
    } catch {
      // the account's choices stay unshown rather than the device's
      this.zustand.set({ art: 'nicht-erreichbar' });
    }
  }

  private dienstHolen(): Promise<KontoDienst> {
    if (this.laden === undefined) {
      return Promise.reject(new Error('Diese Version bietet keine Anmeldung.'));
    }
    this.dienstLaden ??= this.laden().then(
      (dienst) => {
        this.dienst = dienst;
        dienst.beobachten((benutzer) => this.authGeaendert(benutzer));
        return dienst;
      },
      (fehler: unknown) => {
        // a later attempt loads again
        this.dienstLaden = undefined;
        throw fehler;
      }
    );
    return this.dienstLaden;
  }

  /** Auth's Elternteil changed: in another tab, or as the account went. */
  private authGeaendert(benutzer: Benutzer | null): void {
    if (this.eigenerSchritt || this.dienst === undefined) {
      return;
    }
    if (benutzer === null && this.konto !== undefined) {
      void this.vomGeraetNehmen(this.dienst);
    } else if (
      benutzer !== null &&
      this.konto?.benutzer.uid !== benutzer.uid &&
      this.zustand().art !== 'laedt'
    ) {
      // another tab signed in and took this device's choices over
      void this.oeffnen(this.dienst, benutzer);
    }
  }

  /** Another tab set or cleared the `merker` (before Firebase is loaded here). */
  private async merkerGeaendert(): Promise<void> {
    if (this.eigenerSchritt) {
      return;
    }
    if (this.merker.gesetzt() && this.konto === undefined) {
      await this.wiederOeffnen();
    } else if (
      !this.merker.gesetzt() &&
      this.konto !== undefined &&
      this.dienst !== undefined
    ) {
      await this.vomGeraetNehmen(this.dienst);
    }
  }

  private async oeffnen(
    dienst: KontoDienst,
    benutzer: Benutzer
  ): Promise<void> {
    this.konto?.auswahl.beenden();
    const auswahl = await dienst.auswahl(benutzer.uid, (fehler) =>
      this.lesenFehlgeschlagen(fehler)
    );
    this.konto = { benutzer, auswahl };
    this.aktuell.set(auswahl);
    this.zustand.set({ art: 'angemeldet', name: benutzer.name });
  }

  /**
   * The account's selection cannot be read: where the rules refuse it, the
   * account was signed out or deleted elsewhere, so this device signs out
   * too; otherwise the settings say it cannot be read.
   */
  private lesenFehlgeschlagen(fehler: unknown): void {
    const dienst = this.dienst;
    if (dienst === undefined || this.konto === undefined) {
      return;
    }
    if (codeVon(fehler) === NICHT_ERLAUBT) {
      void dienst
        .abmelden()
        .catch(() => undefined)
        .then(() => this.vomGeraetNehmen(dienst));
    } else {
      this.zustand.set({ art: 'nicht-erreichbar' });
    }
  }

  /** After signing out or deleting: nothing of the account stays. */
  private async vomGeraetNehmen(dienst: KontoDienst): Promise<void> {
    this.konto?.auswahl.beenden();
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

function codeVon(fehler: unknown): string | undefined {
  return typeof fehler === 'object' && fehler !== null && 'code' in fehler
    ? String(fehler.code)
    : undefined;
}

/** The `Auswahl` that holds the choices now; nothing while none does yet. */
class AktuelleAuswahl implements Auswahl {
  public readonly teams: Signal<readonly TeamId[] | undefined>;
  public readonly kinder: Signal<readonly Kind[] | undefined>;
  public readonly nichtLesbar: Signal<boolean>;

  /** @param kontoNichtLesbar whether the account could not be opened at all. */
  public constructor(
    private readonly aktuell: Signal<Auswahl | undefined>,
    kontoNichtLesbar: Signal<boolean>
  ) {
    this.teams = computed(() => aktuell()?.teams());
    this.kinder = computed(() => aktuell()?.kinder());
    this.nichtLesbar = computed(
      () => kontoNichtLesbar() || (aktuell()?.nichtLesbar() ?? false)
    );
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
