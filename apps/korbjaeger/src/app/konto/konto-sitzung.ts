import { computed, signal, type Signal } from '@angular/core';
import type {
  PersonId,
  TeamId,
  ClubId,
} from '@wolsok/feat-shared-basketball-data';
import {
  type Vereinsfarben,
  type VereinsfarbenWahl,
  type Auswahl,
  type TeamPlatz,
  LEERE_AUSWAHL,
  selectionIsEmpty,
  selectionWithout,
  selectionJoined,
  listSignals,
  type Kind,
  type MarkierbarerSpieler,
  type LokaleAuswahl,
  type NichtUebernommen,
} from '@wolsok/feat-korbjaeger-auswahl';
import {
  KontoGewechselt,
  KontoNichtGeloescht,
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

/** A step of the session; one runs at a time (`laeuft`). */
export type Schritt = 'anmelden' | 'abmelden' | 'loeschen' | 'uebernehmen';

/** The last step that failed, and how, for whichever page shows it. */
export interface Fehlschlag {
  readonly art: Schritt;
  readonly fehler: unknown;
}

/** What the last takeover into the account shown left on the device. */
export interface UebernahmeHinweis {
  /** The device's Teams and Kinder that did not fit; they stay on it. */
  readonly uebrig: NichtUebernommen;
  /**
   * Whether other choices of the device are not in the account yet: they
   * changed while it took them over, or it failed at a start. The next
   * start takes them over.
   */
  readonly behalten: boolean;
}

const NICHTS: NichtUebernommen = LEERE_AUSWAHL;

/** Remembers on the device that an Elternteil is signed in. */
export interface AnmeldeMerker {
  gesetzt(): boolean;
  setzen(): void;
  loeschen(): void;
  /** Whether a sign-out left Firestore's copy on the device to clear. */
  aufraeumenOffen(): boolean;
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
 * account, which takes off exactly what it wrote (`uebernehmen`), so what
 * joined meanwhile, in any tab, stays. Nothing else clears them, a sign-out neither (here or in
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
  /** What the last takeover into the account shown left on the device. */
  public readonly uebernahme: Signal<UebernahmeHinweis | undefined>;
  /** The step running in this tab, for whichever page shows it. */
  public readonly laeuft: Signal<Schritt | undefined>;
  /** The last step that failed; cleared as the next starts. */
  public readonly fehlschlag: Signal<Fehlschlag | undefined>;

  private readonly zustand = signal<KontoStand>({ art: 'aus' });
  private readonly geladen = signal(false);
  private readonly aktuell = signal<Auswahl | undefined>(undefined);
  private readonly hinweis = signal<
    { readonly uid: string; readonly hinweis: UebernahmeHinweis } | undefined
  >(undefined);
  /** The uid of the account shown. */
  private readonly kontoUid = signal<string | undefined>(undefined);
  private readonly laufend = signal<Schritt | undefined>(undefined);
  private readonly gescheitert = signal<Fehlschlag | undefined>(undefined);
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
  private schritt?: { readonly art: Schritt; readonly lauf: Promise<unknown> };

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
    this.bereit = this.geladen.asReadonly();
    this.uebernahme = computed(() => {
      const hinweis = this.hinweis();
      return hinweis !== undefined && hinweis.uid === this.kontoUid()
        ? hinweis.hinweis
        : undefined;
    });
    this.laeuft = this.laufend.asReadonly();
    this.fehlschlag = this.gescheitert.asReadonly();
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
      if (this.merker.aufraeumenOffen()) {
        void this.aufraeumen();
      }
      return;
    }
    await this.wiederOeffnen();
  }

  /**
   * Clears Firestore's copy a sign-out left on the device, signed out as
   * the device is now; a failure leaves it for the next start.
   */
  private async aufraeumen(): Promise<void> {
    try {
      await (await this.dienstHolen()).zwischenspeicherLeeren();
    } catch {
      // the marker stays: the next start tries again
    }
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
   * offline with `OhneInternet`), then the account itself, both by the uid
   * Google was asked about (`KontoGewechselt` where Auth's Elternteil is
   * another by then; `KontoNichtGeloescht` where Auth refuses the account
   * after its document went, so deleting again finishes it). Call it in the
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
      const { uid } = konto.benutzer;
      await dienst.erneutAnmelden();
      // another tab may have switched accounts while Google asked
      if (dienst.jetzt()?.uid !== uid) {
        throw new KontoGewechselt();
      }
      await dienst.auswahlLoeschen(uid);
      try {
        await dienst.benutzerLoeschen(uid);
      } catch (fehler) {
        throw fehler instanceof KontoGewechselt
          ? fehler
          : new KontoNichtGeloescht(fehler);
      }
      await this.vomGeraetNehmen(dienst);
    });
  }

  /**
   * Runs `tun` as this tab's one step: a call while the same step runs
   * joins it, one while another runs is refused. `tun` starts at once, in
   * the click, as its popup must.
   */
  private einzeln<T>(art: Schritt, tun: () => Promise<T>): Promise<T> {
    if (this.schritt !== undefined) {
      return this.schritt.art === art
        ? (this.schritt.lauf as Promise<T>)
        : Promise.reject(new Error(`${this.schritt.art} läuft noch.`));
    }
    this.gescheitert.set(undefined);
    this.laufend.set(art);
    const lauf = tun()
      .catch((fehler: unknown) => {
        this.gescheitert.set({ art, fehler });
        throw fehler;
      })
      .finally(() => {
        this.schritt = undefined;
        this.laufend.set(undefined);
        // Auth's news while it ran was ignored: catch up with it now
        this.abgleichen();
      });
    this.schritt = { art, lauf };
    return lauf;
  }

  /**
   * Takes the device's choices into the account and then those the account
   * took off the device (`abgeben`, in one read and write); what did not
   * fit stays on the device, and what joined meanwhile, here or in another
   * tab, goes over in another round. Where something new still stays after
   * the last, the next start takes it over (`behalten`). Tells the account
   * shown what it left (`uebernahme`).
   */
  private async uebernehmen(
    dienst: KontoDienst,
    benutzer: Benutzer
  ): Promise<NichtUebernommen> {
    let uebrig = NICHTS;
    let neu = this.lokal.neuGelesen();
    for (let mal = 0; mal < UEBERNAHMEN_HOECHSTENS; mal++) {
      const passtNicht = await dienst.geraetUebernehmen(benutzer.uid, neu);
      uebrig = selectionJoined(uebrig, passtNicht);
      neu = selectionWithout(
        this.lokal.abgeben(selectionWithout(neu, passtNicht)),
        uebrig
      );
      if (selectionIsEmpty(neu)) {
        break;
      }
    }
    this.hinweisSetzen(benutzer.uid, {
      uebrig,
      behalten: !selectionIsEmpty(neu),
    });
    return uebrig;
  }

  private hinweisSetzen(uid: string, hinweis: UebernahmeHinweis): void {
    this.hinweis.set({ uid, hinweis });
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

  /**
   * Opens the account of the Elternteil signed in before; gives way where an
   * opening or a sign-out (another tab's) came meanwhile, leaving the marker
   * and the account it shows alone.
   */
  private async wiederOeffnen(): Promise<void> {
    const nummer = this.oeffnung;
    this.zustand.set({ art: 'laedt' });
    this.aktuell.set(undefined);
    let benutzer: Benutzer | null;
    try {
      const dienst = await this.dienstHolen();
      benutzer = await dienst.angemeldet();
      if (nummer !== this.oeffnung) {
        return;
      }
      if (benutzer === null) {
        // the marker goes last: a start that fails before clears again
        await dienst.zwischenspeicherLeeren();
        if (nummer === this.oeffnung) {
          this.merker.loeschen();
          this.aufDemGeraet('abgemeldet');
        }
        return;
      }
      await this.oeffnen(dienst, benutzer);
    } catch {
      // the account's choices stay unshown rather than the device's
      if (nummer === this.oeffnung) {
        this.zustand.set({ art: 'nicht-erreichbar' });
      }
      return;
    }
    if (this.konto?.benutzer.uid === benutzer.uid) {
      await this.behalteneUebernehmen(this.konto.benutzer);
    }
  }

  /**
   * Takes over the choices a sign-in left on the device, as a step of its
   * own (no deletion runs meanwhile); where that fails, they stay for the
   * next start and the settings say so, the account open all the same.
   */
  private async behalteneUebernehmen(benutzer: Benutzer): Promise<void> {
    const dienst = this.dienst;
    if (dienst === undefined || selectionIsEmpty(this.lokal.neuGelesen())) {
      return;
    }
    try {
      await this.einzeln('uebernehmen', () =>
        this.uebernehmen(dienst, benutzer)
      );
    } catch {
      this.hinweisSetzen(benutzer.uid, { uebrig: NICHTS, behalten: true });
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
      // another tab signed in and took this device's choices over; a
      // failure shows as `nicht-erreichbar`
      this.oeffnen(this.dienst, benutzer).catch(() => undefined);
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
    let auswahl: KontoAuswahl;
    try {
      auswahl = await dienst.auswahl(benutzer.uid, (fehler) =>
        this.lesenFehlgeschlagen(fehler)
      );
    } catch (fehler) {
      if (nummer === this.oeffnung) {
        // Auth's next word about this Elternteil opens it again
        this.geoeffnetFuer = undefined;
        this.zustand.set({ art: 'nicht-erreichbar' });
      }
      throw fehler;
    }
    if (nummer !== this.oeffnung || dienst.jetzt()?.uid !== benutzer.uid) {
      auswahl.beenden();
      if (nummer === this.oeffnung) {
        this.abgleichen();
      }
      return;
    }
    this.konto = { benutzer, auswahl };
    this.kontoUid.set(benutzer.uid);
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
    this.kontoUid.set(undefined);
    this.geoeffnetFuer = undefined;
    return ++this.oeffnung;
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
  public readonly vereinsfarben: Signal<
    readonly VereinsfarbenWahl[] | undefined
  >;
  public readonly nichtLesbar: Signal<boolean>;
  /** The store behind it: the device's, an account's, or none while it switches. */
  public readonly quelle: Signal<unknown>;

  /** @param kontoNichtLesbar whether the account could not be opened at all. */
  public constructor(
    private readonly aktuell: Signal<Auswahl | undefined>,
    kontoNichtLesbar: Signal<boolean>
  ) {
    // an account that cannot be read shows none of what it read before
    const signals = listSignals<undefined>((list) =>
      kontoNichtLesbar() ? undefined : aktuell()?.[list]()
    );
    this.teams = signals.teams;
    this.kinder = signals.kinder;
    this.vereinsfarben = signals.vereinsfarben;
    this.nichtLesbar = computed(
      () => kontoNichtLesbar() || (aktuell()?.nichtLesbar() ?? false)
    );
    this.quelle = computed(() => aktuell()?.quelle());
  }

  public folgen(team: TeamId, platz?: TeamPlatz): Promise<void> {
    return this.mit((auswahl) => auswahl.folgen(team, platz));
  }

  public entfolgen(team: TeamId): Promise<TeamPlatz | undefined> {
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

  public vereinsfarbenSetzen(
    verein: ClubId,
    farben: Vereinsfarben
  ): Promise<void> {
    return this.mit((auswahl) => auswahl.vereinsfarbenSetzen(verein, farben));
  }

  public vereinsfarbenZuruecksetzen(verein: ClubId): Promise<void> {
    return this.mit((auswahl) => auswahl.vereinsfarbenZuruecksetzen(verein));
  }

  /** Changes only once `teams` is read, as `Auswahl` asks. */
  private mit<T>(aendern: (auswahl: Auswahl) => Promise<T>): Promise<T> {
    const auswahl = this.aktuell();
    return auswahl === undefined || this.teams() === undefined
      ? Promise.reject(new Error('Meine Teams sind nicht gelesen.'))
      : aendern(auswahl);
  }
}
