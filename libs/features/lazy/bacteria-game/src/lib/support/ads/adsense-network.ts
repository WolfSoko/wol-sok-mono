import type { AdNetwork } from './ad-network';
import type { AdSenseOptions } from './ad-network-options';

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

export type AdSenseWindow = Window & {
  adsbygoogle?: object[];
  __tcfapi?: TcfApi;
  googlefc?: {
    callbackQueue?: Record<string, () => void>[];
    showRevocationMessage?: () => void;
  };
};

export const ADSENSE_SCRIPT_ID = 'bacteria-game-adsense';

export const TCF_POLL_INTERVAL_MS = 200;
const TCF_POLL_MAX_TRIES = 150;

function adSenseScriptUrl(client: string): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
}

/** A choice was made in the banner, or the GDPR asks for none. */
function isAnswered(tcData: TcData, success: boolean): boolean {
  return (
    success &&
    (tcData.gdprApplies === false ||
      tcData.eventStatus === 'tcloaded' ||
      tcData.eventStatus === 'useractioncomplete')
  );
}

/**
 * Google AdSense. Its script brings Google's consent banner (Privacy &
 * Messaging, a TCF v2.2 CMP), whose answer the game reads through the
 * standard `__tcfapi`; whether the ads may be personalised AdSense reads
 * from that choice itself.
 */
export class AdSenseNetwork implements AdNetwork {
  public readonly name = 'adsense';
  private readonly window: AdSenseWindow;

  public constructor(
    private readonly options: AdSenseOptions,
    private readonly document: Document
  ) {
    this.window = document.defaultView as AdSenseWindow;
  }

  public load(onConsentAnswered: () => void): void {
    let blocked = false;
    const script = this.document.createElement('script');
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = adSenseScriptUrl(this.options.client);
    script.onerror = () => (blocked = true);
    this.document.head.appendChild(script);
    // The script installs `__tcfapi` once it has loaded. Without it - an
    // ad blocker, no consent message set up - no ads are asked for.
    if (this.listen(onConsentAnswered)) return;
    let tries = 0;
    const poll = setInterval(() => {
      if (
        blocked ||
        this.listen(onConsentAnswered) ||
        ++tries >= TCF_POLL_MAX_TRIES
      ) {
        clearInterval(poll);
      }
    }, TCF_POLL_INTERVAL_MS);
  }

  public show(host: HTMLElement): () => void {
    const unit = this.document.createElement('ins');
    unit.className = 'adsbygoogle';
    unit.style.display = 'block';
    unit.dataset['adFormat'] = 'auto';
    unit.dataset['fullWidthResponsive'] = 'true';
    unit.dataset['adClient'] = this.options.client;
    unit.dataset['adSlot'] = this.options.slot;
    host.appendChild(unit);
    (this.window.adsbygoogle ??= []).push({});
    // AdSense has no call to take an ad back: the unit simply goes.
    return () => unit.remove();
  }

  public openConsentSettings(): void {
    const window = this.window;
    const googlefc = (window.googlefc ??= {});
    (googlefc.callbackQueue ??= []).push({
      CONSENT_DATA_READY: () => window.googlefc?.showRevocationMessage?.(),
    });
  }

  private listen(onConsentAnswered: () => void): boolean {
    const tcfApi = this.window.__tcfapi;
    if (typeof tcfApi !== 'function') return false;
    tcfApi('addEventListener', 2, (tcData, success) => {
      if (isAnswered(tcData, success)) onConsentAnswered();
    });
    return true;
  }
}
