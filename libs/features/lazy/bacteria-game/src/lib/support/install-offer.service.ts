import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { isObject } from '../state/is-object';
import { DeviceStorage } from '../storage/game-storage';
import { GAME_SUPPORT } from './game-support';
import { playStoreUrl } from './legal-links';
import { isTwaSession } from './twa-session';

/** Where the player is, as far as installing goes. */
export type InstallPlatform = 'android' | 'ios' | 'other';

/** Chrome's offer to install the web app, which the page may hold and show later. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** The device remembers a dismissed offer under this key. */
export const INSTALL_OFFER_KEY = 'bacteria-game.install-offer';
/** How long a dismissed offer stays away. */
export const INSTALL_OFFER_DISMISSED_MS = 30 * 24 * 60 * 60 * 1000;

/** The display modes an installed web app opens in - the browser's is `browser`. */
const INSTALLED_DISPLAY_MODES = ['standalone', 'fullscreen', 'minimal-ui'];

/** When the offer was dismissed, from what the device stored - null for never. */
export function parseDismissedAt(stored: unknown): number | null {
  if (!isObject(stored)) return null;
  const at = stored['dismissedAt'];
  return typeof at === 'number' && Number.isFinite(at) ? at : null;
}

/** Android, iOS or anything else, from the browser's user agent string. */
export function detectInstallPlatform(
  userAgent: string,
  maxTouchPoints: number
): InstallPlatform {
  if (/android/i.test(userAgent)) return 'android';
  // An iPad on iPadOS 13+ says it is a Mac, but a Mac has no touch screen.
  if (
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  ) {
    return 'ios';
  }
  return 'other';
}

/**
 * The offer to play the game as an app: the Android app from Google Play,
 * or the web app installed from the browser. Made only on the game's own
 * site in a browser - not inside the shell, not inside the Play Store app,
 * and not once the web app is installed - and only where there is a way to
 * install: on Android and iOS always, elsewhere once the browser offers its
 * install prompt. A dismissed offer stays away for a month, per device.
 */
@Injectable({ providedIn: 'root' })
export class InstallOffer {
  private readonly options = inject(GAME_SUPPORT);
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(DeviceStorage);

  private readonly inBrowser = signal(false);
  private readonly promptEvent = signal<BeforeInstallPromptEvent | null>(null);
  /** True while the browser's install prompt is open. */
  private readonly prompting = signal(false);
  /**
   * When the offer was dismissed, null for never - undefined until the
   * device has answered. Set by `dismiss` as well, since the local storage
   * tells only other tabs of a write.
   */
  private readonly dismissedAt = signal<number | null | undefined>(undefined);

  public readonly platform: InstallPlatform;
  /** The Play listing of the Android app, null without the game's support options. */
  public readonly storeUrl: string | null;
  /** True while the browser offers to install the web app on a click. */
  public readonly canInstallWebApp = computed(
    () => this.promptEvent() !== null
  );

  public readonly visible = computed(() => {
    if (!this.inBrowser()) return false;
    const dismissedAt = this.dismissedAt();
    if (dismissedAt === undefined) return false;
    if (
      dismissedAt !== null &&
      Date.now() - dismissedAt < INSTALL_OFFER_DISMISSED_MS
    ) {
      return false;
    }
    return this.platform !== 'other' || this.canInstallWebApp();
  });

  public constructor() {
    const window = this.document.defaultView;
    const navigator = window?.navigator;
    this.platform = detectInstallPlatform(
      navigator?.userAgent ?? '',
      navigator?.maxTouchPoints ?? 0
    );
    const options = this.options;
    this.storeUrl = options ? playStoreUrl(options.androidPackage) : null;
    if (!options || !window) return;

    this.storage
      .watch(INSTALL_OFFER_KEY)
      .pipe(map(parseDismissedAt), takeUntilDestroyed())
      .subscribe((at) => this.dismissedAt.set(at));

    const onPrompt = (event: Event): void => {
      // Chrome's own mini-infobar stays away; the banner asks instead.
      event.preventDefault();
      this.promptEvent.set(event as BeforeInstallPromptEvent);
    };
    const onInstalled = (): void => {
      this.promptEvent.set(null);
      this.inBrowser.set(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    });

    afterNextRender(() => {
      if (
        !isTwaSession(this.document, options.androidPackage) &&
        !this.isInstalled(window)
      ) {
        this.inBrowser.set(true);
      }
    });
  }

  /**
   * Shows the browser's install prompt, where it offered one. The banner
   * stays up while the prompt is open; the browser lets the prompt show
   * once, so a refused one is gone until the next page load.
   */
  public async installWebApp(): Promise<void> {
    const event = this.promptEvent();
    if (!event || this.prompting()) return;
    this.prompting.set(true);
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === 'accepted') this.inBrowser.set(false);
    } catch {
      // The prompt was not available after all: the banner falls back to the store link.
    } finally {
      this.prompting.set(false);
      this.promptEvent.set(null);
    }
  }

  /** Puts the offer away for a month on this device. */
  public dismiss(): void {
    const now = Date.now();
    this.dismissedAt.set(now);
    this.storage.write(INSTALL_OFFER_KEY, { dismissedAt: now });
  }

  /** True when the page runs as an installed web app, not in a browser tab. */
  private isInstalled(window: Window): boolean {
    // Safari on iOS has no display-mode media feature, but this flag.
    if ((window.navigator as { standalone?: boolean }).standalone === true) {
      return true;
    }
    if (typeof window.matchMedia !== 'function') return false;
    return INSTALLED_DISPLAY_MODES.some(
      (mode) => window.matchMedia(`(display-mode: ${mode})`).matches
    );
  }
}
