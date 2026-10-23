import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LateGameStorage } from '../../testing/late-game-storage';
import { DeviceStorage } from '../storage/game-storage';
import { GAME_SUPPORT, GameSupportOptions } from './game-support';
import {
  detectInstallPlatform,
  INSTALL_OFFER_DISMISSED_MS,
  INSTALL_OFFER_KEY,
  InstallOffer,
  parseDismissedAt,
} from './install-offer.service';

const OPTIONS: GameSupportOptions = {
  buyMeACoffeeHandle: 'wolf',
  playTipProductIds: [],
  androidPackage: 'de.wolsok.bacteriawars',
  ads: null,
};

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('detectInstallPlatform', () => {
  it('tells Android, iOS and the rest apart, the iPad posing as a Mac included', () => {
    expect(detectInstallPlatform(ANDROID_UA, 5)).toBe('android');
    expect(detectInstallPlatform(IPHONE_UA, 5)).toBe('ios');
    expect(
      detectInstallPlatform(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
        5
      )
    ).toBe('ios');
    expect(
      detectInstallPlatform(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
        0
      )
    ).toBe('other');
    expect(detectInstallPlatform(DESKTOP_UA, 0)).toBe('other');
  });
});

describe('parseDismissedAt', () => {
  it('reads the time from what the device stored, and nothing from anything else', () => {
    expect(parseDismissedAt({ dismissedAt: 1700000000000 })).toBe(
      1700000000000
    );
    expect(parseDismissedAt({ dismissedAt: 'yesterday' })).toBeNull();
    expect(parseDismissedAt('1')).toBeNull();
    expect(parseDismissedAt(null)).toBeNull();
  });
});

describe('InstallOffer', () => {
  let storage: LateGameStorage;
  let matches: (query: string) => boolean;

  beforeEach(() => {
    storage = new LateGameStorage();
    matches = () => false;
    sessionStorage.clear();
    window.matchMedia = jest.fn((query: string) => ({
      matches: matches(query),
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    history.replaceState(null, '', '/');
  });

  function setUp(
    userAgent: string,
    options: GameSupportOptions | null = OPTIONS,
    referrer = ''
  ): InstallOffer {
    jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    jest.spyOn(document, 'referrer', 'get').mockReturnValue(referrer);
    TestBed.configureTestingModule({
      providers: [
        { provide: GAME_SUPPORT, useValue: options },
        { provide: DeviceStorage, useValue: storage },
      ],
    });
    const offer = TestBed.inject(InstallOffer);
    TestBed.inject(ApplicationRef).tick();
    return offer;
  }

  function installPrompt(outcome: 'accepted' | 'dismissed' = 'accepted'): {
    prompt: jest.Mock;
    event: Event;
    choose: () => void;
  } {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    const prompt = jest.fn().mockResolvedValue(undefined);
    let choose: () => void = () => undefined;
    Object.assign(event, {
      prompt,
      userChoice: new Promise((resolve) => {
        choose = () => resolve({ outcome });
      }),
    });
    window.dispatchEvent(event);
    return { prompt, event, choose };
  }

  it('offers the Play Store app on Android, once the device has answered', () => {
    const offer = setUp(ANDROID_UA);
    expect(offer.visible()).toBe(false);

    storage.flush();

    expect(offer.visible()).toBe(true);
    expect(offer.platform).toBe('android');
    expect(offer.storeUrl).toBe(
      'https://play.google.com/store/apps/details?id=de.wolsok.bacteriawars'
    );
    expect(offer.canInstallWebApp()).toBe(false);
  });

  it('offers the home screen on iOS', () => {
    const offer = setUp(IPHONE_UA);
    storage.flush();

    expect(offer.visible()).toBe(true);
    expect(offer.platform).toBe('ios');
  });

  it('offers nothing on a desktop until the browser offers to install', async () => {
    const offer = setUp(DESKTOP_UA);
    storage.flush();
    expect(offer.visible()).toBe(false);

    const { prompt, event, choose } = installPrompt();

    // Chrome's own mini-infobar stays away.
    expect(event.defaultPrevented).toBe(true);
    expect(offer.visible()).toBe(true);
    expect(offer.canInstallWebApp()).toBe(true);

    const installing = offer.installWebApp();
    await Promise.resolve();
    // The banner stays up while the browser's prompt is open.
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(offer.visible()).toBe(true);
    void offer.installWebApp();
    expect(prompt).toHaveBeenCalledTimes(1);

    choose();
    await installing;

    // Installed: the browser tab is no longer where the game is played.
    expect(offer.visible()).toBe(false);
  });

  it('keeps the store link when the browser prompt is refused on Android', async () => {
    const offer = setUp(ANDROID_UA);
    storage.flush();
    const { choose } = installPrompt('dismissed');

    const installing = offer.installWebApp();
    choose();
    await installing;

    // The browser shows its prompt once per page load; the store stays.
    expect(offer.canInstallWebApp()).toBe(false);
    expect(offer.visible()).toBe(true);
  });

  it('is put away for a month, per device', () => {
    const offer = setUp(ANDROID_UA);
    storage.flush();
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    offer.dismiss();
    // Gone at once - the local storage tells only other tabs of the write.
    expect(offer.visible()).toBe(false);
    storage.flush();

    expect(storage.stored(INSTALL_OFFER_KEY)).toEqual({ dismissedAt: now });
    expect(offer.visible()).toBe(false);

    jest
      .spyOn(Date, 'now')
      .mockReturnValue(now + INSTALL_OFFER_DISMISSED_MS - DAY_MS);
    storage.write(INSTALL_OFFER_KEY, { dismissedAt: now });
    storage.flush();
    expect(offer.visible()).toBe(false);

    jest
      .spyOn(Date, 'now')
      .mockReturnValue(now + INSTALL_OFFER_DISMISSED_MS + DAY_MS);
    storage.write(INSTALL_OFFER_KEY, { dismissedAt: now - 1 });
    storage.flush();
    expect(offer.visible()).toBe(true);
  });

  it('offers nothing inside the Play Store app', () => {
    const offer = setUp(
      ANDROID_UA,
      OPTIONS,
      'android-app://de.wolsok.bacteriawars/'
    );
    storage.flush();

    expect(offer.visible()).toBe(false);
  });

  it('offers nothing once the web app is installed', () => {
    matches = (query) => query === '(display-mode: standalone)';
    const offer = setUp(ANDROID_UA);
    storage.flush();

    expect(offer.visible()).toBe(false);
  });

  it('offers nothing inside the shell, which has no support options', () => {
    const offer = setUp(ANDROID_UA, null);
    storage.flush();
    installPrompt();

    expect(offer.visible()).toBe(false);
    expect(offer.storeUrl).toBeNull();
  });
});
