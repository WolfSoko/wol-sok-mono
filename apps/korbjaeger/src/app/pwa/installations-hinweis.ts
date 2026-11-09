import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  InjectionToken,
  makeEnvironmentProviders,
  provideAppInitializer,
  signal,
  type EnvironmentProviders,
  type Signal,
} from '@angular/core';
import {
  flagGesetzt,
  flagSetzen,
  geraeteSpeicher,
  INSTALLATION_ABGELEHNT_SCHLUESSEL,
} from '../geraete-speicher';

/**
 * What the install hint offers: nothing, the browser's own install
 * dialog (`beforeinstallprompt`), or the way through Safari's share menu
 * on iOS, which has no such dialog.
 */
export type InstallationsAngebot = 'keins' | 'installieren' | 'ios';

/** What decides the install hint, as the browser tells it. */
export interface InstallationsLage {
  /** The app runs from the home screen or as an installed app. */
  readonly installiert: boolean;
  /** The parent dismissed the hint before. */
  readonly abgelehnt: boolean;
  /** The browser offered its install dialog (`beforeinstallprompt`). */
  readonly aufforderung: boolean;
  /** Safari on iOS, which installs through its share menu only. */
  readonly iosSafari: boolean;
}

/** Whether a hint may offer anything at all: not installed, not dismissed. */
export function darfAnbieten({
  installiert,
  abgelehnt,
}: Pick<InstallationsLage, 'installiert' | 'abgelehnt'>): boolean {
  return !installiert && !abgelehnt;
}

/** Which install hint, if any, fits `lage`. */
export function installationsAngebot(
  lage: InstallationsLage
): InstallationsAngebot {
  if (!darfAnbieten(lage)) {
    return 'keins';
  }
  if (lage.aufforderung) {
    return 'installieren';
  }
  return lage.iosSafari ? 'ios' : 'keins';
}

/** What of `navigator` the install hint reads. */
export interface InstallationsNavigator {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  /** Safari on iOS: `true` once opened from the home screen. */
  readonly standalone?: boolean;
}

/**
 * Other browsers and in-app views on iOS, which carry Safari's token too
 * but have no "Zum Home-Bildschirm" in their share menu: Chrome, Firefox,
 * Edge, Opera, the Google app, DuckDuckGo, Facebook and Instagram.
 */
const ANDERER_IOS_BROWSER =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|Ddg\/|DuckDuckGo|FBAN|FBAV|Instagram/;

/**
 * Whether the browser is Safari on an iPhone or iPad: an iPad's Safari
 * says it is a Mac, but has a touch screen; the others on iOS name
 * themselves (`ANDERER_IOS_BROWSER`).
 */
export function istIosSafari(navigator: InstallationsNavigator): boolean {
  const agent = navigator.userAgent;
  const iosGeraet =
    /iPhone|iPad|iPod/.test(agent) ||
    (agent.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return (
    iosGeraet && agent.includes('Safari') && !ANDERER_IOS_BROWSER.test(agent)
  );
}

/** The browser's `beforeinstallprompt` event, which no DOM typing names. */
export interface InstallAufforderung extends Event {
  prompt(): Promise<unknown>;
}

/** What of the browser the install hint uses; specs pass a fake. */
export interface InstallationsUmgebung {
  readonly fenster: Pick<
    Window,
    'addEventListener' | 'removeEventListener' | 'matchMedia'
  >;
  readonly navigator: InstallationsNavigator;
  readonly speicher: () => Storage | undefined;
}

/** The browser's window, `undefined` where there is none. */
export const INSTALLATIONS_UMGEBUNG = new InjectionToken<
  InstallationsUmgebung | undefined
>('INSTALLATIONS_UMGEBUNG', {
  providedIn: 'root',
  factory: () =>
    typeof window === 'undefined'
      ? undefined
      : { fenster: window, navigator, speicher: geraeteSpeicher },
});

/**
 * The install hint's state: which offer fits (`angebot`), the browser's
 * install dialog (`installieren`) and the dismissal (`ablehnen`), kept in
 * `localStorage` for good where the device lets it, else for the visit.
 * Never offers anything where the app already runs installed, and keeps
 * the browser's own install offer away only while a page shows the hint
 * (`anzeigen`) that would offer it.
 */
@Injectable({ providedIn: 'root' })
export class InstallationsHinweis {
  private readonly umgebung = inject(INSTALLATIONS_UMGEBUNG);
  private readonly aufforderung = signal<InstallAufforderung | undefined>(
    undefined
  );
  private readonly abgelehnt = signal(this.liesAbgelehnt());
  private readonly installiert = signal(this.laeuftInstalliert());
  /** How many pages show the hint now (`anzeigen`). */
  private seitenMitHinweis = 0;
  private readonly iosSafari =
    this.umgebung !== undefined && istIosSafari(this.umgebung.navigator);

  public readonly angebot: Signal<InstallationsAngebot> = computed(() =>
    installationsAngebot({
      installiert: this.installiert(),
      abgelehnt: this.abgelehnt(),
      aufforderung: this.aufforderung() !== undefined,
      iosSafari: this.iosSafari,
    })
  );

  public constructor() {
    const fenster = this.umgebung?.fenster;
    if (fenster === undefined) {
      return;
    }
    const aufgefordert = (event: Event): void => {
      // the browser's own mini-infobar gives way only to a hint shown;
      // its event stays usable either way, for a hint shown later
      if (this.uebernimmtAufforderung()) {
        event.preventDefault();
      }
      this.aufforderung.set(event as InstallAufforderung);
    };
    const installiert = (): void => {
      this.installiert.set(true);
      this.aufforderung.set(undefined);
    };
    fenster.addEventListener('beforeinstallprompt', aufgefordert);
    fenster.addEventListener('appinstalled', installiert);
    inject(DestroyRef).onDestroy(() => {
      fenster.removeEventListener('beforeinstallprompt', aufgefordert);
      fenster.removeEventListener('appinstalled', installiert);
    });
  }

  /**
   * A page shows the hint (from now until the returned function is called):
   * only then does the hint take the browser's own install offer over.
   */
  public anzeigen(): () => void {
    this.seitenMitHinweis++;
    return () => {
      this.seitenMitHinweis--;
    };
  }

  /**
   * Opens the browser's install dialog. It opens once per event, so the
   * hint goes until the browser offers it again, also where the browser
   * refuses it (an event used up): never rejects.
   */
  public async installieren(): Promise<void> {
    const aufforderung = this.aufforderung();
    if (aufforderung === undefined) {
      return;
    }
    this.aufforderung.set(undefined);
    try {
      await aufforderung.prompt();
    } catch {
      // the event is spent; the browser offers a new one where it can
    }
  }

  /** Hides the hint, for good where the device keeps it. */
  public ablehnen(): void {
    this.abgelehnt.set(true);
    // storage full or blocked: hidden for this visit only
    flagSetzen(
      this.umgebung?.speicher(),
      INSTALLATION_ABGELEHNT_SCHLUESSEL,
      true
    );
  }

  /** Whether the hint would offer the browser's dialog on a page now. */
  private uebernimmtAufforderung(): boolean {
    return (
      this.seitenMitHinweis > 0 &&
      darfAnbieten({
        installiert: this.installiert(),
        abgelehnt: this.abgelehnt(),
      })
    );
  }

  private liesAbgelehnt(): boolean {
    return flagGesetzt(
      this.umgebung?.speicher(),
      INSTALLATION_ABGELEHNT_SCHLUESSEL
    );
  }

  private laeuftInstalliert(): boolean {
    const umgebung = this.umgebung;
    if (umgebung === undefined) {
      return false;
    }
    if (umgebung.navigator.standalone === true) {
      return true;
    }
    return (
      typeof umgebung.fenster.matchMedia === 'function' &&
      umgebung.fenster.matchMedia('(display-mode: standalone)').matches
    );
  }
}

/**
 * Starts `InstallationsHinweis` with the app, so it hears a
 * `beforeinstallprompt` that fires before a page shows the hint.
 */
export function provideInstallationsHinweis(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      inject(InstallationsHinweis);
    }),
  ]);
}
