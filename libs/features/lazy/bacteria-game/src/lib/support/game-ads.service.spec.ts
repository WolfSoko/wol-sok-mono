import { TestBed } from '@angular/core/testing';
import {
  AD_SCRIPT_ID,
  AdsWindow,
  GameAds,
  TcData,
  TCF_POLL_INTERVAL_MS,
} from './game-ads.service';
import { GAME_SUPPORT_OPTIONS } from '../../testing/game-support-options';
import { GAME_SUPPORT, GameSupportOptions } from './game-support';

const OPTIONS: GameSupportOptions = {
  ...GAME_SUPPORT_OPTIONS,
  ads: { client: 'ca-pub-1', slot: '42' },
};

describe('GameAds', () => {
  const adsWindow = window as AdsWindow;
  let listeners: ((tcData: TcData, success: boolean) => void)[];

  function setUp(options: GameSupportOptions | null = OPTIONS): GameAds {
    TestBed.configureTestingModule({
      providers: [{ provide: GAME_SUPPORT, useValue: options }],
    });
    return TestBed.inject(GameAds);
  }

  function installCmp(): void {
    adsWindow.__tcfapi = (_command, _version, callback) => {
      listeners.push(callback);
    };
  }

  function report(tcData: TcData): void {
    for (const listener of listeners) listener(tcData, true);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    listeners = [];
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    document.getElementById(AD_SCRIPT_ID)?.remove();
    delete adsWindow.__tcfapi;
    delete adsWindow.adsbygoogle;
    delete adsWindow.googlefc;
  });

  it('loads the ad script and listens for the consent once', () => {
    installCmp();
    const ads = setUp();

    ads.start();
    ads.start();

    const scripts = document.querySelectorAll(`#${AD_SCRIPT_ID}`);
    expect(scripts).toHaveLength(1);
    expect((scripts[0] as HTMLScriptElement).src).toBe(
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1'
    );
    expect(listeners).toHaveLength(1);
  });

  it('loads nothing without ads', () => {
    const ads = setUp({ ...OPTIONS, ads: null });

    ads.start();

    expect(document.getElementById(AD_SCRIPT_ID)).toBeNull();
    expect(ads.ad).toBeNull();
  });

  it('stops waiting for the consent banner when the script is blocked', () => {
    const ads = setUp();
    ads.start();

    document.getElementById(AD_SCRIPT_ID)?.dispatchEvent(new Event('error'));
    jest.advanceTimersByTime(TCF_POLL_INTERVAL_MS);
    installCmp();
    jest.advanceTimersByTime(TCF_POLL_INTERVAL_MS * 5);

    expect(listeners).toHaveLength(0);
  });

  it('loads nothing without support options, as inside the shell', () => {
    const ads = setUp(null);

    ads.start();

    expect(document.getElementById(AD_SCRIPT_ID)).toBeNull();
  });

  it('waits for the player to answer the consent banner', () => {
    installCmp();
    const ads = setUp();
    ads.start();

    report({ eventStatus: 'cmpuishown' });
    expect(ads.consentAnswered()).toBe(false);

    report({ eventStatus: 'useractioncomplete' });
    expect(ads.consentAnswered()).toBe(true);
  });

  it('shows ads at once to a player who answered on an earlier visit', () => {
    installCmp();
    const ads = setUp();
    ads.start();

    report({ eventStatus: 'tcloaded' });

    expect(ads.consentAnswered()).toBe(true);
  });

  it('needs no answer where the GDPR does not apply', () => {
    installCmp();
    const ads = setUp();
    ads.start();

    report({ eventStatus: 'cmpuishown', gdprApplies: false });

    expect(ads.consentAnswered()).toBe(true);
  });

  it('listens once the script has brought the consent banner', () => {
    const ads = setUp();
    ads.start();
    expect(listeners).toHaveLength(0);

    installCmp();
    jest.advanceTimersByTime(TCF_POLL_INTERVAL_MS);
    jest.advanceTimersByTime(TCF_POLL_INTERVAL_MS * 5);

    expect(listeners).toHaveLength(1);
  });

  it('fills a slot by pushing to the ad queue', () => {
    const ads = setUp();

    ads.fill();

    expect(adsWindow.adsbygoogle).toEqual([{}]);
  });

  it('opens the consent banner again once the consent data is ready', () => {
    const ads = setUp();

    ads.openConsentSettings();
    // The consent script may set up its own object meanwhile.
    const queue = adsWindow.googlefc?.callbackQueue;
    const showRevocationMessage = jest.fn();
    adsWindow.googlefc = { callbackQueue: queue, showRevocationMessage };
    queue?.[0]?.['CONSENT_DATA_READY']?.();

    expect(showRevocationMessage).toHaveBeenCalled();
  });
});
