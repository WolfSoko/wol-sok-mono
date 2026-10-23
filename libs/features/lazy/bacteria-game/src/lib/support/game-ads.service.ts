import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { GAME_SUPPORT } from './game-support';

/** The slice of an IAB TCF v2.2 TCData object the consent is read from. */
export interface TcData {
  readonly eventStatus: 'tcloaded' | 'cmpuishown' | 'useractioncomplete';
  readonly gdprApplies?: boolean;
  readonly purpose?: { readonly consents?: Readonly<Record<number, boolean>> };
  readonly vendor?: { readonly consents?: Readonly<Record<number, boolean>> };
}

export type TcfApi = (
  command: 'addEventListener',
  version: 2,
  callback: (tcData: TcData, success: boolean) => void
) => void;

export type AdsWindow = Window & {
  adsbygoogle?: object[];
  __tcfapi?: TcfApi;
  googlefc?: {
    callbackQueue?: Record<string, () => void>[];
    showRevocationMessage?: () => void;
  };
};

export const AD_SCRIPT_ID = 'bacteria-game-ads';

/** IAB TCF vendor id of "Google Advertising Products". */
const GOOGLE_VENDOR_ID = 755;
/** TCF purposes: 1 store and access information on a device, 3 and 4 build and use an ad profile. */
const PURPOSE_STORAGE = 1;
const PURPOSE_AD_PROFILE = 3;
const PURPOSE_AD_SELECT = 4;

export const TCF_POLL_INTERVAL_MS = 200;
const TCF_POLL_MAX_TRIES = 150;

/**
 * The AdSense script and the consent it waits for. The script also brings
 * the consent banner (Google Privacy & Messaging, a TCF v2.2 CMP), so it
 * loads with the app; the ad slots stay empty until the player has made a
 * choice, and show non-personalised ads unless they agreed to more.
 */
@Injectable({ providedIn: 'root' })
export class GameAds {
  private readonly options = inject(GAME_SUPPORT)?.ads ?? null;
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView as AdsWindow | null;

  private readonly answered = signal(false);
  private readonly targeted = signal(false);

  /** The ad unit the screens show, null without ads. */
  public readonly ad = this.options?.slot ? this.options : null;
  /** True once the player has answered the consent banner, or does not need to. */
  public readonly consentAnswered = this.answered.asReadonly();
  /** Whether the ads may be personalised. */
  public readonly personalised = this.targeted.asReadonly();
  public readonly ready = computed(() => this.ad !== null && this.answered());

  public start(): void {
    if (!this.ad || !this.window) return;
    if (!this.document.getElementById(AD_SCRIPT_ID)) {
      const script = this.document.createElement('script');
      script.id = AD_SCRIPT_ID;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(this.ad.client)}`;
      this.document.head.appendChild(script);
    }
    // The script installs `__tcfapi` once it has loaded.
    if (this.listen()) return;
    let tries = 0;
    const poll = setInterval(() => {
      if (this.listen() || ++tries >= TCF_POLL_MAX_TRIES) clearInterval(poll);
    }, TCF_POLL_INTERVAL_MS);
  }

  /** Fills an `<ins class="adsbygoogle">` that is in the page. */
  public fill(): void {
    if (!this.window) return;
    (this.window.adsbygoogle ??= []).push({});
  }

  /**
   * Opens the consent banner again. The choice made before holds until the
   * player completes a new one.
   */
  public openConsentSettings(): void {
    if (!this.window) return;
    const googlefc = (this.window.googlefc ??= {});
    (googlefc.callbackQueue ??= []).push({
      CONSENT_DATA_READY: () => googlefc.showRevocationMessage?.(),
    });
  }

  private listen(): boolean {
    const tcfApi = this.window?.__tcfapi;
    if (typeof tcfApi !== 'function') return false;
    tcfApi('addEventListener', 2, (tcData, success) => {
      if (success) this.apply(tcData);
    });
    return true;
  }

  private apply(tcData: TcData): void {
    if (tcData.gdprApplies === false) {
      this.publish(true);
      return;
    }
    if (
      tcData.eventStatus !== 'tcloaded' &&
      tcData.eventStatus !== 'useractioncomplete'
    ) {
      return;
    }
    const purposes = tcData.purpose?.consents ?? {};
    const vendors = tcData.vendor?.consents ?? {};
    this.publish(
      purposes[PURPOSE_STORAGE] === true &&
        purposes[PURPOSE_AD_PROFILE] === true &&
        purposes[PURPOSE_AD_SELECT] === true &&
        vendors[GOOGLE_VENDOR_ID] === true
    );
  }

  private publish(personalised: boolean): void {
    this.targeted.set(personalised);
    this.answered.set(true);
  }
}
