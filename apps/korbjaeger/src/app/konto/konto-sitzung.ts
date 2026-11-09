import { computed, signal, type Signal } from '@angular/core';
import type { PersonId, TeamId } from '@wolsok/feat-shared-basketball-data';
import type { Auswahl } from '../auswahl/auswahl';
import { gleicheKinder } from '../auswahl/auswahl-aenderungen';
import type { AuswahlInhalt } from '../auswahl/auswahl-dokument';
import { gleicheFolge } from '../gleiche-folge';
import type { Kind, MarkierbarerSpieler } from '../auswahl/kind';
import type { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import type { NichtUebernommen } from '../auswahl/zusammenfuehren';
import type { GeraeteSperre } from '../auswahl/geraete-sperre';
import {
  NichtAllesGesendet,
  OhneInternet,
  type Benutzer,
  type KontoAuswahl,
  type KontoDienst,
} from './konto-dienst';
import { fehlerCode } from './fehler-code';

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
 * How often a sign-in takes the device's choices over again where they
 * changed while it did (the Elternteil, another tab).
 */
const UEBERNAHMEN_HOECHSTENS = 3;

/**
 * The account of an Elternteil and the `Auswahl` that goes with it: the
 * device's (`LokaleAuswahl`) signed out, the account's (`KontoAuswahl`)
 * signed in. Firebase is loaded (`laden`) only to sign in (`vorbereiten`,
 * once the settings open) or to open the account of an Elternteil signed
 * in before (`merker`), so a visitor without an account never contacts
 * Google. Every tab follows a sign-in or sign-out in another: through
 * Auth's state once Firebase is loaded, through the `merker` before.
 *
 * The device's choices leave it in one place only: a takeover into the
 * account that found them unchanged once written (`uebernehmen`, under the
 * device's lock). Nothing else clears them, a sign-out neither (here or in
 * another tab, after a takeover that failed too), so choices a takeover
 * kept stay for the next.
 */
export class KontoSitzung {
  public readonly stand: Signal<KontoStand>;
  /** The screens' `Auswahl`: whichever holds Meine Teams and Kinder now. */
  public readonly auswahl: Auswahl;
  /**
   * Whether Firebase is loaded, so a click opens Google's popup at once:
   * the settings offer the sign-in only then.
   */
  public readonly bereit: Signal<boolean>;
  /**
   * Whether choices of the device are not in the account yet: they changed
   * while a sign-in took them over, or the takeover failed at a start. The
   * next start takes them over again.
   */
  public readonly geraetBehalten: Signal<boolean>;

  private readonly zustand = signal<KontoStand>({ art: 'aus' });
  private readonly geladen = signal(false);
  private readonly aktuell = signal<Auswahl | undefined>(undefined);
  private readonly behalten = signal(false);
  /** The uid whose account is shown or opening; none signed out. */
  private geoeffnetFuer?: string;
  /** Counts the openings: only the latest shows its account. */
  private oeffnung = 0;
  private dienst?: KontoDienst;
  private dienstLaden?: Promise<KontoDienst>;
  private konto?: {
    readonly benutzer: Benutzer;
    readonly auswahl: KontoAuswahl;
  };
  /**
   * The sign-in, sign-out or deletion running in this tab: one at a time,
   * a second call of the same joins it. Auth's news is this tab's own
   * while one runs.
   */
  private schritt?: { readonly art: string; readonly lauf: Promise<unknown> };

  /**
   * @param laden loads Firebase; `undefined` where this build offers no
   *   sign-in.
   * @param istOnline whether the device has a network (`navigator.onLine`).
   * @param sperre the device's lock of the `Auswahl` (`AUSWAHL_SPERRE`),
   *   which `lokal` writes under too.
   */
  public constructor(
    private readonly lokal: LokaleAuswahl,
    private readonly laden: (() => Promise<KontoDienst>) | undefined,
    private readonly merker: AnmeldeMerker,
    private readonly istOnline: () => boolean = () =>
      globalThis.navigator?.onLine ?? true,
    private readonly sperre: GeraeteSperre = async (tun) => tun()
  ) {
    this.stand = this.zustand.asReadonly();
    this.bereit = this.geladen.asReadonly();
    this.geraetBehalten = this.behalten.asReadonly();
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
  public anmelden(): Promise<NichtUebernommen> {
    return this.einzeln('anmelden', async () => {
      const dienst = this.dienst ?? (await this.dienstHolen());
      const benutzer = await dienst.mitGoogleAnmelden();
      let uebrig: NichtUebernommen;
      try {
        uebrig = await this.uebernehmen(dienst, benutzer);
      } catch (fehler) {
        // the failure to report is the takeover's, whatever signing out
        // does (`zwischenspeicherLeeren` never rejects); nothing the
        // takeover read of the account stays, the device's choices do
        await dienst.abmelden().catch(() => undefined);
        await dienst.zwischenspeicherLeeren();
        throw fehler;
      }
      this.merker.setzen();
      await this.oeffnen(dienst, benutzer);
      return uebrig;
    });
  }

  /**
   * Signs out: the account's choices leave the device, the device's start
   * empty. Where Auth does not sign out, nothing changes.
   */
  public abmelden(): Promise<void> {
    return this.einzeln('abmelden', async () => {
      const { dienst, konto } = this;
      if (dienst === undefined || konto === undefined) {
        return;
      }
      // signing out clears the device's copy: a change not yet sent would go
      if (!(await dienst.allesGesendet())) {
        throw new NichtAllesGesendet();
      }
      await dienst.abmelden();
      await this.vomGeraetNehmen(dienst);
    });
  }

  /**
   * Deletes the account: asks Google first (Auth deletes an account only
   * shortly after a sign-in), so nothing is deleted where the Elternteil
   * cancels; then its document, which only a server can confirm (refused
   * offline with `OhneInternet`), then the account itself. Call it in the
   * click: the popup opens at once.
   */
  public loeschen(): Promise<void> {
    return this.einzeln('loeschen', async () => {
      const { dienst, konto } = this;
      if (dienst === undefined || konto === undefined) {
        return;
      }
      if (!this.istOnline()) {
        throw new OhneInternet();
      }
      await dienst.erneutAnmelden();
      await dienst.auswahlLoeschen(konto.benutzer.uid);
      await dienst.benutzerLoeschen();
      await this.vomGeraetNehmen(dienst);
    });
  }

  /**
   * Runs `tun` as this tab's one step: a call while the same step runs
   * joins it, one while another runs is refused. `tun` starts at once, in
   * the click, as its popup must.
   */
  private einzeln<T>(art: string, tun: () => Promise<T>): Promise<T> {
    if (this.schritt !== undefined) {
      return this.schritt.art === art
        ? (this.schritt.lauf as Promise<T>)
        : Promise.reject(new Error(`${this.schritt.art} läuft noch.`));
    }
    const lauf = tun().finally(() => {
      this.schritt = undefined;
      // Auth's news while it ran was ignored: catch up with it now
      this.abgleichen();
    });
    this.schritt = { art, lauf };
    return lauf;
  }

  /**
   * Takes the device's choices into the account and then off the device,
   * under the device's lock, so no tab changes them between the reading and
   * the clearing; where the browser has no lock, again where they changed
   * meanwhile (here or, read from the storage itself, in another tab).
   * Where they still changed during the last try, they stay on the device
   * (`geraetBehalten`), for the next start to take over.
   */
  private uebernehmen(
    dienst: KontoDienst,
    benutzer: Benutzer
  ): Promise<NichtUebernommen> {
    return this.sperre(async () => {
      let uebrig: NichtUebernommen = { teams: 0, kinder: 0 };
      for (let mal = 0; mal < UEBERNAHMEN_HOECHSTENS; mal++) {
        const geraet = this.lokal.neuGelesen();
        uebrig = await dienst.geraetUebernehmen(benutzer.uid, geraet);
        if (gleicherInhalt(geraet, this.lokal.neuGelesen())) {
          this.lokal.leeren();
          this.behalten.set(false);
          return uebrig;
        }
      }
      this.behalten.set(true);
      return uebrig;
    });
  }

  /**
   * Once a step of this tab ended: where Auth's Elternteil is no longer the
   * one shown (another tab signed out or in meanwhile), follows it.
   */
  private abgleichen(): void {
    if (this.dienst !== undefined) {
      this.authGeaendert(this.dienst.jetzt());
    }
  }

  private async wiederOeffnen(): Promise<void> {
    this.zustand.set({ art: 'laedt' });
    this.aktuell.set(undefined);
    try {
      const dienst = await this.dienstHolen();
      const benutzer = await dienst.angemeldet();
      if (benutzer === null) {
        // the marker goes last: a start that fails before clears again
        await dienst.zwischenspeicherLeeren();
        this.merker.loeschen();
        this.aufDemGeraet('abgemeldet');
        return;
      }
      await this.oeffnen(dienst, benutzer);
    } catch {
      // the account's choices stay unshown rather than the device's
      this.zustand.set({ art: 'nicht-erreichbar' });
      return;
    }
    await this.behalteneUebernehmen();
  }

  /**
   * Takes over the choices a sign-in kept on the device, as they changed
   * while it took them over; where that fails, they stay for the next start
   * and the settings say so, the account open all the same.
   */
  private async behalteneUebernehmen(): Promise<void> {
    const { dienst, konto } = this;
    if (dienst === undefined || konto === undefined) {
      return;
    }
    if (istLeer(this.lokal.neuGelesen())) {
      this.behalten.set(false);
      return;
    }
    try {
      await this.uebernehmen(dienst, konto.benutzer);
    } catch {
      this.behalten.set(true);
    }
  }

  private dienstHolen(): Promise<KontoDienst> {
    if (this.laden === undefined) {
      return Promise.reject(new Error('Diese Version bietet keine Anmeldung.'));
    }
    this.dienstLaden ??= this.laden().then(
      (dienst) => {
        this.dienst = dienst;
        this.geladen.set(true);
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

  /**
   * Auth's Elternteil changed: in another tab, or as the account went. Also
   * while an account opens: a newer opening or a sign-out supersedes it.
   */
  private authGeaendert(benutzer: Benutzer | null): void {
    if (this.schritt !== undefined || this.dienst === undefined) {
      return;
    }
    if (benutzer === null && this.geoeffnetFuer !== undefined) {
      void this.vomGeraetNehmen(this.dienst);
    } else if (benutzer !== null && this.geoeffnetFuer !== benutzer.uid) {
      // another tab signed in and took this device's choices over
      void this.oeffnen(this.dienst, benutzer);
    }
  }

  /** Another tab set or cleared the `merker` (before Firebase is loaded here). */
  private async merkerGeaendert(): Promise<void> {
    if (this.schritt !== undefined) {
      return;
    }
    if (this.merker.gesetzt() && this.geoeffnetFuer === undefined) {
      await this.wiederOeffnen();
    } else if (
      !this.merker.gesetzt() &&
      this.geoeffnetFuer !== undefined &&
      this.dienst !== undefined
    ) {
      await this.vomGeraetNehmen(this.dienst);
    }
  }

  /**
   * Shows the account of `benutzer`; nothing of the one before while it
   * opens. Superseded by a later opening or a sign-out, or where Auth's
   * Elternteil changed meanwhile, it closes what it opened and shows nothing
   * (Auth's news, ignored during a step, is caught up with as it ends).
   */
  private async oeffnen(
    dienst: KontoDienst,
    benutzer: Benutzer
  ): Promise<void> {
    const nummer = this.schliessen();
    this.geoeffnetFuer = benutzer.uid;
    this.aktuell.set(undefined);
    this.zustand.set({ art: 'laedt' });
    const auswahl = await dienst.auswahl(benutzer.uid, (fehler) =>
      this.lesenFehlgeschlagen(fehler)
    );
    if (nummer !== this.oeffnung || dienst.jetzt()?.uid !== benutzer.uid) {
      auswahl.beenden();
      if (nummer === this.oeffnung) {
        this.abgleichen();
      }
      return;
    }
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
    if (fehlerCode(fehler) === NICHT_ERLAUBT) {
      void dienst
        .abmelden()
        .catch(() => undefined)
        .then(() => this.vomGeraetNehmen(dienst));
    } else {
      this.zustand.set({ art: 'nicht-erreichbar' });
    }
  }

  /**
   * After signing out or deleting: nothing of the account stays; the
   * device's choices do, as only a takeover clears them.
   */
  private async vomGeraetNehmen(dienst: KontoDienst): Promise<void> {
    this.schliessen();
    this.merker.loeschen();
    this.behalten.set(false);
    this.aufDemGeraet('abgemeldet');
    await dienst.zwischenspeicherLeeren();
  }

  /**
   * Closes the account shown or opening, superseding any opening still
   * running; returns the number of the next opening.
   */
  private schliessen(): number {
    this.konto?.auswahl.beenden();
    this.konto = undefined;
    this.geoeffnetFuer = undefined;
    return ++this.oeffnung;
  }

  private aufDemGeraet(art: 'aus' | 'abgemeldet'): void {
    this.aktuell.set(this.lokal);
    this.zustand.set({ art });
  }
}

function gleicherInhalt(a: AuswahlInhalt, b: AuswahlInhalt): boolean {
  return gleicheFolge(a.teams, b.teams) && gleicheKinder(a.kinder, b.kinder);
}

function istLeer(inhalt: AuswahlInhalt): boolean {
  return inhalt.teams.length === 0 && inhalt.kinder.length === 0;
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
