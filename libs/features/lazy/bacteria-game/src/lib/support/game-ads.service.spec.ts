import { TestBed } from '@angular/core/testing';
import {
  AD_SCRIPT_ID,
  AdsWindow,
  GameAds,
  TcData,
  TCF_POLL_INTERVAL_MS,
} from './game-ads.service';
import { GAME_SUPPORT, GameSupportOptions } from './game-support';

const OPTIONS: GameSupportOptions = {
  buyMeACoffeeHandle: 'wolf',
  playTipProductIds: [],
  ads: { client: 'ca-pub-1', slot: '42' },
};

const ALL_CONSENTS = {
  purpose: { consents: { 1: true, 3: true, 4: true } },
  vendor: { consents: { 755: true } },
};

describe('GameAds', () => {
  const adsWindow = window as AdsWindow;
  let listener: ((tcData: TcData, success: boolean) => void) | undefined;

  function setUp(options: GameSupportOptions | null = OPTIONS): GameAds {
    TestBed.configureTestingModule({
      providers: [{ provide: GAME_SUPPORT, useValue: options }],
    });
    return TestBed.inject(GameAds);
  }

  function installCmp(): void {
    adsWindow.__tcfapi = (_command, _version, callback) => {
      listener = callback;
    };
  }

  afterEach(() => {
    document.getElementById(AD_SCRIPT_ID)?.remove();
    delete adsWindow.__tcfapi;
    delete adsWindow.adsbygoogle;
    delete adsWindow.googlefc;
    listener = undefined;
    jest.useRealTimers();
  });

  it('loads the ad script once with the publisher id', () => {
    const ads = setUp();

    ads.start();
    ads.start();

    const scripts = document.querySelectorAll(`#${AD_SCRIPT_ID}`);
    expect(scripts).toHaveLength(1);
    expect((scripts[0] as HTMLScriptElement).src).toBe(
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1'
    );
  });

  it('loads nothing without an ad unit', () => {
    const ads = setUp({ ...OPTIONS, ads: { client: 'ca-pub-1', slot: '' } });

    ads.start();

    expect(document.getElementById(AD_SCRIPT_ID)).toBeNull();
    expect(ads.ad).toBeNull();
  });

  it('loads nothing without support options, as inside the shell', () => {
    const ads = setUp(null);

    ads.start();

    expect(document.getElementById(AD_SCRIPT_ID)).toBeNull();
  });

  it('waits for the consent before it shows ads', () => {
    installCmp();
    const ads = setUp();
    ads.start();

    listener?.({ eventStatus: 'cmpuishown', ...ALL_CONSENTS }, true);
    expect(ads.ready()).toBe(false);

    listener?.({ eventStatus: 'useractioncomplete', ...ALL_CONSENTS }, true);
    expect(ads.ready()).toBe(true);
    expect(ads.personalised()).toBe(true);
  });

  it('shows non-personalised ads when the player declined profiling', () => {
    installCmp();
    const ads = setUp();
    ads.start();

    listener?.(
      {
        eventStatus: 'tcloaded',
        purpose: { consents: { 1: true } },
        vendor: { consents: { 755: true } },
      },
      true
    );

    expect(ads.ready()).toBe(true);
    expect(ads.personalised()).toBe(false);
  });

  it('needs no answer where the GDPR does not apply', () => {
    installCmp();
    const ads = setUp();
    ads.start();

    listener?.({ eventStatus: 'tcloaded', gdprApplies: false }, true);

    expect(ads.ready()).toBe(true);
    expect(ads.personalised()).toBe(true);
  });

  it('listens once the script has brought the consent banner', () => {
    jest.useFakeTimers();
    const ads = setUp();
    ads.start();
    expect(listener).toBeUndefined();

    installCmp();
    jest.advanceTimersByTime(TCF_POLL_INTERVAL_MS);

    expect(listener).toBeDefined();
  });

  it('fills a slot by pushing to the ad queue', () => {
    const ads = setUp();

    ads.fill();

    expect(adsWindow.adsbygoogle).toEqual([{}]);
  });

  it('opens the consent banner again once the consent data is ready', () => {
    const ads = setUp();
    const showRevocationMessage = jest.fn();
    adsWindow.googlefc = { showRevocationMessage };

    ads.openConsentSettings();
    expect(showRevocationMessage).not.toHaveBeenCalled();
    adsWindow.googlefc.callbackQueue?.[0]?.['CONSENT_DATA_READY']?.();

    expect(showRevocationMessage).toHaveBeenCalled();
  });
});
