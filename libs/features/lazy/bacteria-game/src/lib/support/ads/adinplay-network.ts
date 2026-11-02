import type { AdNetwork } from './ad-network';
import type { AdinPlayOptions } from './ad-network-options';
import { addScript } from './add-script';

/** What the AdinPlay tag reads before it loads, and queues calls on. */
interface AipTag {
  cmd?: {
    display?: (() => void)[];
    player?: (() => void)[];
  };
  cmp?: { show: boolean; button: boolean };
  disableInterstitialAd?: boolean;
}

export type AdinPlayWindow = Window & {
  aiptag?: AipTag;
  aipDisplayTag?: {
    display(placementId: string): void;
    destroy(placementId: string): void;
  };
  aipAPItag?: { showCMPScreen(): void };
};

export const ADINPLAY_SCRIPT_ID = 'bacteria-game-adinplay';

/**
 * The events AdinPlay's consent tool sends on `document` once the choice is
 * known: made now, found from an earlier visit, or not needed at all.
 */
export const ADINPLAY_CONSENT_EVENTS = [
  'aip_consent',
  'aip_consentapproved',
  'aip_consentrejected',
  'aip_consentnotrequired',
] as const;

function adinPlayScriptUrl(publisherId: string): string {
  return `https://api.adinplay.com/libs/aiptag/pub/${encodeURIComponent(publisherId)}/tag.min.js`;
}

/**
 * AdinPlay, an ad network for browser games. Its tag brings its own
 * consent tool, which tells its answer through events on `document`. A
 * display ad goes into an element whose id is the placement's, so the
 * menu shows one ad at a time.
 */
export class AdinPlayNetwork implements AdNetwork {
  private readonly window: AdinPlayWindow;

  public constructor(
    private readonly options: AdinPlayOptions,
    private readonly document: Document
  ) {
    this.window = document.defaultView as AdinPlayWindow;
  }

  public load(onConsentAnswered: () => void): void {
    // Listening before the tag loads: it may answer at once, from the
    // choice of an earlier visit. The first answer is the one the game
    // waits for, so it ends all four listeners.
    const listening = new AbortController();
    const answered = () => {
      listening.abort();
      onConsentAnswered();
    };
    for (const event of ADINPLAY_CONSENT_EVENTS) {
      this.document.addEventListener(event, answered, {
        signal: listening.signal,
      });
    }
    // The settings have to be there before the tag loads.
    const aiptag = (this.window.aiptag ??= {});
    const cmd = (aiptag.cmd ??= {});
    cmd.display ??= [];
    cmd.player ??= [];
    // The footer, the Help and the privacy policy open the consent tool
    // again (`openConsentSettings`), so it needs no floating button.
    aiptag.cmp = { show: true, button: false };
    // An interstitial would cover the game.
    aiptag.disableInterstitialAd = true;
    addScript(this.document, {
      id: ADINPLAY_SCRIPT_ID,
      src: adinPlayScriptUrl(this.options.publisherId),
      // A tag that never loads never answers.
      onError: () => listening.abort(),
    });
  }

  public show(host: HTMLElement): () => void {
    const { placementId } = this.options;
    const container = this.document.createElement('div');
    container.id = placementId;
    host.appendChild(container);
    this.queueDisplay((tag) => tag.display(placementId));
    return () => {
      this.queueDisplay((tag) => tag.destroy(placementId));
      container.remove();
    };
  }

  public openConsentSettings(): void {
    this.window.aipAPItag?.showCMPScreen();
  }

  /** Runs once the tag is there: at once, after it loaded. */
  private queueDisplay(
    call: (tag: NonNullable<AdinPlayWindow['aipDisplayTag']>) => void
  ): void {
    const queue = this.window.aiptag?.cmd?.display;
    queue?.push(() => {
      const tag = this.window.aipDisplayTag;
      if (tag) call(tag);
    });
  }
}
