import { TestBed } from '@angular/core/testing';
import {
  ADINPLAY_ADS,
  ADSENSE_ADS,
  GAME_SUPPORT_OPTIONS,
} from '../../../testing/game-support-options';
import { GAME_SUPPORT, GameSupportOptions } from '../game-support';
import { ADINPLAY_SCRIPT_ID, AdinPlayWindow } from './adinplay-network';
import { ADSENSE_SCRIPT_ID } from './adsense-network';
import { CONSENT_BANNER_WAIT_MS, GameAds } from './game-ads.service';

describe('GameAds', () => {
  const adsWindow = window as AdinPlayWindow;

  function setUp(options: GameSupportOptions | null): GameAds {
    TestBed.configureTestingModule({
      providers: [{ provide: GAME_SUPPORT, useValue: options }],
    });
    return TestBed.inject(GameAds);
  }

  function scripts(): Element[] {
    return [
      ...document.querySelectorAll(
        `#${ADINPLAY_SCRIPT_ID}, #${ADSENSE_SCRIPT_ID}`
      ),
    ];
  }

  beforeEach(() => {
    // AdSense polls for its consent banner meanwhile.
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    scripts().forEach((script) => script.remove());
    delete adsWindow.aiptag;
    delete adsWindow.aipAPItag;
  });

  it.each([
    { ads: ADINPLAY_ADS, scriptId: ADINPLAY_SCRIPT_ID },
    { ads: ADSENSE_ADS, scriptId: ADSENSE_SCRIPT_ID },
  ])('loads the script of $ads.network once', ({ ads, scriptId }) => {
    const gameAds = setUp({ ...GAME_SUPPORT_OPTIONS, ads });

    gameAds.start();
    gameAds.start();

    expect(gameAds.networkName).toBe(ads.network);
    expect(scripts().map((script) => script.id)).toEqual([scriptId]);
  });

  it('loads nothing and shows nothing without ads', () => {
    const gameAds = setUp({ ...GAME_SUPPORT_OPTIONS, ads: null });
    const host = document.createElement('div');

    gameAds.start();
    gameAds.show(host)();
    gameAds.openConsentSettings();

    expect(gameAds.networkName).toBeNull();
    expect(scripts()).toEqual([]);
    expect(host.children).toHaveLength(0);
  });

  it('loads nothing without support options, as inside the shell', () => {
    const gameAds = setUp(null);

    gameAds.start();

    expect(gameAds.networkName).toBeNull();
    expect(scripts()).toEqual([]);
  });

  it("answers once the network's consent banner did", () => {
    const gameAds = setUp({ ...GAME_SUPPORT_OPTIONS, ads: ADINPLAY_ADS });
    gameAds.start();
    expect(gameAds.consentAnswered()).toBe(false);

    document.dispatchEvent(new Event('aip_consent'));

    expect(gameAds.consentAnswered()).toBe(true);
  });

  it('is done with the consent banner at once without a network', () => {
    const gameAds = setUp({ ...GAME_SUPPORT_OPTIONS, ads: null });

    gameAds.start();

    expect(gameAds.consentSettled()).toBe(true);
  });

  it('is done with the consent banner once it answered, or did not come in time', () => {
    const answering = setUp({ ...GAME_SUPPORT_OPTIONS, ads: ADINPLAY_ADS });
    answering.start();
    expect(answering.consentSettled()).toBe(false);
    document.dispatchEvent(new Event('aip_consent'));
    expect(answering.consentSettled()).toBe(true);

    TestBed.resetTestingModule();
    const blocked = setUp({ ...GAME_SUPPORT_OPTIONS, ads: ADSENSE_ADS });
    blocked.start();
    jest.advanceTimersByTime(CONSENT_BANNER_WAIT_MS - 1);
    expect(blocked.consentSettled()).toBe(false);
    jest.advanceTimersByTime(1);
    expect(blocked.consentSettled()).toBe(true);
  });

  it("shows the network's ad and opens its consent banner", () => {
    const showCMPScreen = jest.fn();
    adsWindow.aipAPItag = { showCMPScreen };
    const gameAds = setUp({ ...GAME_SUPPORT_OPTIONS, ads: ADINPLAY_ADS });
    gameAds.start();
    const host = document.createElement('div');

    const remove = gameAds.show(host);
    expect(host.querySelector('#BW_menu')).not.toBeNull();
    remove();
    gameAds.openConsentSettings();

    expect(host.children).toHaveLength(0);
    expect(showCMPScreen).toHaveBeenCalled();
  });
});
