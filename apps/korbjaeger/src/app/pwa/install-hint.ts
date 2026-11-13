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
import { deviceStorage } from '@wolsok/utils-browser-storage';
import { isFlagSet, setFlag, INSTALL_DISMISSED_KEY } from '../device-storage';

/**
 * What the install hint offers: nothing, the browser's own install
 * dialog (`beforeinstallprompt`), or the way through the share menu on
 * iOS, whose browsers have no such dialog.
 */
export type InstallOffer = 'none' | 'install' | 'ios';

/** What decides the install hint, as the browser tells it. */
export interface InstallSituation {
  /** The app runs from the home screen or as an installed app. */
  readonly installed: boolean;
  /** The parent dismissed the hint before. */
  readonly dismissed: boolean;
  /** The browser offered its install dialog (`beforeinstallprompt`). */
  readonly prompt: boolean;
  /** iOS, whose browsers install through their share menu only. */
  readonly ios: boolean;
}

/** Whether a hint may offer anything at all: not installed, not dismissed. */
export function mayOffer({
  installed,
  dismissed,
}: Pick<InstallSituation, 'installed' | 'dismissed'>): boolean {
  return !installed && !dismissed;
}

/** Which install hint, if any, fits `situation`. */
export function installOffer(situation: InstallSituation): InstallOffer {
  if (!mayOffer(situation)) {
    return 'none';
  }
  if (situation.prompt) {
    return 'install';
  }
  return situation.ios ? 'ios' : 'none';
}

/** What of `navigator` the install hint reads. */
export interface InstallNavigator {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  /** Safari on iOS: `true` once opened from the home screen. */
  readonly standalone?: boolean;
}

/**
 * In-app web views on iOS (the Google app, Facebook, Instagram): they have
 * no share menu with "Zum Home-Bildschirm". A plain web view of an app
 * names no `Safari/` at all.
 */
const IOS_IN_APP = /GSA\/|FBAN|FBAV|Instagram/;

/** Other iOS browsers, which name themselves beside Safari's token. */
const IOS_OTHER_BROWSER = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|Ddg\/|DuckDuckGo/;

/** Since iOS 16.4 other browsers offer "Zum Home-Bildschirm" too. */
const OTHER_BROWSERS_FROM: readonly [number, number] = [16, 4];

/**
 * Whether the page runs on an iPhone or iPad in a browser whose share menu
 * offers "Zum Home-Bildschirm": Safari always (an iPad's says it is a Mac,
 * but has a touch screen), another browser from iOS 16.4; never an app's
 * web view (no `Safari/` token, or a named one: `IOS_IN_APP`).
 */
export function isIosWithShareMenu(navigator: InstallNavigator): boolean {
  const agent = navigator.userAgent;
  const iosDevice =
    /iPhone|iPad|iPod/.test(agent) ||
    (agent.includes('Macintosh') && navigator.maxTouchPoints > 1);
  if (!iosDevice || !agent.includes('Safari/') || IOS_IN_APP.test(agent)) {
    return false;
  }
  return (
    !IOS_OTHER_BROWSER.test(agent) || fromIosVersion(agent, OTHER_BROWSERS_FROM)
  );
}

/** Whether `agent` names an iOS version (`OS 16_4`) of at least `ab`. */
function fromIosVersion(
  agent: string,
  [fromMajor, fromMinor]: readonly [number, number]
): boolean {
  const match = /\bOS (\d+)_(\d+)/.exec(agent);
  if (match === null) {
    return false;
  }
  const [major, minor] = [Number(match[1]), Number(match[2])];
  return major > fromMajor || (major === fromMajor && minor >= fromMinor);
}

/** The browser's `beforeinstallprompt` event, which no DOM typing names. */
export interface InstallPrompt extends Event {
  prompt(): Promise<unknown>;
  /** Settles once the parent answered its dialog, the browser's own too. */
  readonly userChoice?: Promise<unknown>;
}

/** What of the browser the install hint uses; specs pass a fake. */
export interface InstallEnvironment {
  readonly browserWindow: Pick<
    Window,
    'addEventListener' | 'removeEventListener' | 'matchMedia'
  >;
  readonly navigator: InstallNavigator;
  readonly storage: () => Storage | undefined;
}

/** The browser's window, `undefined` where there is none. */
export const INSTALL_ENVIRONMENT = new InjectionToken<
  InstallEnvironment | undefined
>('INSTALLATIONS_UMGEBUNG', {
  providedIn: 'root',
  factory: () =>
    typeof window === 'undefined'
      ? undefined
      : { browserWindow: window, navigator, storage: deviceStorage },
});

/**
 * The install hint's state: which offer fits (`offer`), the browser's
 * install dialog (`install`) and the dismissal (`dismiss`), kept in
 * `localStorage` for good where the device lets it, else for the visit.
 * Never offers anything where the app already runs installed, and keeps
 * the browser's own install offer away only while a page shows the hint
 * (`show`) that would offer it.
 */
@Injectable({ providedIn: 'root' })
export class InstallHint {
  private readonly environment = inject(INSTALL_ENVIRONMENT);
  private readonly prompt = signal<InstallPrompt | undefined>(undefined);
  private readonly dismissed = signal(this.readDismissed());
  private readonly installed = signal(this.runsInstalled());
  /** How many pages show the hint now (`show`). */
  private pagesWithHint = 0;
  private readonly ios =
    this.environment !== undefined &&
    isIosWithShareMenu(this.environment.navigator);

  public readonly offer: Signal<InstallOffer> = computed(() =>
    installOffer({
      installed: this.installed(),
      dismissed: this.dismissed(),
      prompt: this.prompt() !== undefined,
      ios: this.ios,
    })
  );

  public constructor() {
    const browserWindow = this.environment?.browserWindow;
    if (browserWindow === undefined) {
      return;
    }
    const prompted = (event: Event): void => {
      // the browser's own mini-infobar gives way only to a hint shown;
      // its event stays usable either way, for a hint shown later
      if (this.takesPrompt()) {
        event.preventDefault();
      }
      const promptEvent = event as InstallPrompt;
      this.prompt.set(promptEvent);
      // answered (also in the browser's own dialog, on another page): spent
      promptEvent.userChoice?.then(
        () => this.used(promptEvent),
        () => this.used(promptEvent)
      );
    };
    const installed = (): void => {
      this.installed.set(true);
      this.prompt.set(undefined);
    };
    browserWindow.addEventListener('beforeinstallprompt', prompted);
    browserWindow.addEventListener('appinstalled', installed);
    inject(DestroyRef).onDestroy(() => {
      browserWindow.removeEventListener('beforeinstallprompt', prompted);
      browserWindow.removeEventListener('appinstalled', installed);
    });
  }

  /**
   * A page shows the hint (from now until the returned function is called):
   * only then does the hint take the browser's own install offer over.
   */
  public show(): () => void {
    this.pagesWithHint++;
    return () => {
      this.pagesWithHint--;
    };
  }

  /**
   * Opens the browser's install dialog. It opens once per event, so the
   * hint goes until the browser offers it again, also where the browser
   * refuses it (an event used up): never rejects.
   */
  public async install(): Promise<void> {
    const promptEvent = this.prompt();
    if (promptEvent === undefined) {
      return;
    }
    this.prompt.set(undefined);
    try {
      await promptEvent.prompt();
    } catch {
      // the event is spent; the browser offers a new one where it can
    }
  }

  /** Drops `prompt` where it is still the one offered. */
  private used(promptEvent: InstallPrompt): void {
    if (this.prompt() === promptEvent) {
      this.prompt.set(undefined);
    }
  }

  /** Hides the hint, for good where the device keeps it. */
  public dismiss(): void {
    this.dismissed.set(true);
    // storage full or blocked: hidden for this visit only
    setFlag(this.environment?.storage(), INSTALL_DISMISSED_KEY, true);
  }

  /** Whether the hint would offer the browser's dialog on a page now. */
  private takesPrompt(): boolean {
    return (
      this.pagesWithHint > 0 &&
      mayOffer({
        installed: this.installed(),
        dismissed: this.dismissed(),
      })
    );
  }

  private readDismissed(): boolean {
    return isFlagSet(this.environment?.storage(), INSTALL_DISMISSED_KEY);
  }

  private runsInstalled(): boolean {
    const environment = this.environment;
    if (environment === undefined) {
      return false;
    }
    if (environment.navigator.standalone === true) {
      return true;
    }
    return (
      typeof environment.browserWindow.matchMedia === 'function' &&
      environment.browserWindow.matchMedia('(display-mode: standalone)').matches
    );
  }
}

/**
 * Starts `InstallHint` with the app, so it hears a
 * `beforeinstallprompt` that fires before a page shows the hint.
 */
export function provideInstallHint(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      inject(InstallHint);
    }),
  ]);
}
