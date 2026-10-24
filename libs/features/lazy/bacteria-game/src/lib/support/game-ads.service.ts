import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { GAME_SUPPORT } from './game-support';

/** The slice of an IAB TCF v2.2 TCData object the game waits for. */
export interface TcData {
  readonly eventStatus: 'tcloaded' | 'cmpuishown' | 'useractioncomplete';
  readonly gdprApplies?: boolean;
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

export const TCF_POLL_INTERVAL_MS = 200;
const TCF_POLL_MAX_TRIES = 150;

/**
 * The AdSense script and the consent it waits for. The script also brings
 * the consent banner (Google Privacy & Messaging, a TCF v2.2 CMP), so it
 * loads with the app; the ad slots stay empty until the player has made a
 * choice. Whether the ads may be personalised AdSense reads from that
 * choice itself.
 */
@Injectable({ providedIn: 'root' })
export class GameAds {
  private readonly options = inject(GAME_SUPPORT)?.ads ?? null;
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView as AdsWindow | null;

  private readonly answered = signal(false);
  private started = false;

  /** The ad unit the screens show, null without ads. */
  public readonly ad = this.options;
  /**
   * True once the consent banner reported a choice, or that none is
   * needed - and with it, that ads may be asked for and the banner is
   * there to open again.
   */
  public readonly consentAnswered = this.answered.asReadonly();

  public start(): void {
    if (!this.ad || !this.window || this.started) return;
    this.started = true;
    let blocked = false;
    if (!this.document.getElementById(AD_SCRIPT_ID)) {
      const script = this.document.createElement('script');
      script.id = AD_SCRIPT_ID;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(this.ad.client)}`;
      script.onerror = () => (blocked = true);
      this.document.head.appendChild(script);
    }
    // The script installs `__tcfapi` once it has loaded. Without it - an
    // ad blocker, no consent message set up - no ads are asked for.
    if (this.listen()) return;
    let tries = 0;
    const poll = setInterval(() => {
      if (blocked || this.listen() || ++tries >= TCF_POLL_MAX_TRIES) {
        clearInterval(poll);
      }
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
    const window = this.window;
    if (!window) return;
    const googlefc = (window.googlefc ??= {});
    (googlefc.callbackQueue ??= []).push({
      CONSENT_DATA_READY: () => window.googlefc?.showRevocationMessage?.(),
    });
  }

  private listen(): boolean {
    const tcfApi = this.window?.__tcfapi;
    if (typeof tcfApi !== 'function') return false;
    tcfApi('addEventListener', 2, (tcData, success) => {
      if (
        success &&
        (tcData.gdprApplies === false ||
          tcData.eventStatus === 'tcloaded' ||
          tcData.eventStatus === 'useractioncomplete')
      ) {
        this.answered.set(true);
      }
    });
    return true;
  }
}
