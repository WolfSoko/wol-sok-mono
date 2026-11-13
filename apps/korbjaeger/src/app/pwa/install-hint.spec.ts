import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  INSTALL_ENVIRONMENT,
  InstallHint,
  installOffer,
  isIosWithShareMenu,
  provideInstallHint,
  type InstallNavigator,
  type InstallEnvironment,
} from './install-hint';
import { INSTALL_DISMISSED_KEY } from '../device-storage';
import { BLOCKED_STORAGE, mapStorage } from '../../testing/storage';

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const CHROME_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1';
const SAFARI_IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';

/** Other iOS browsers, whose share menu has "Zum Home-Bildschirm" since iOS 16.4. */
const OTHER_IOS_BROWSERS = {
  Chrome: CHROME_IPHONE,
  Firefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  Edge: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/126.2592.86 Mobile/15E148 Safari/605.1.15',
  DuckDuckGo:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 Ddg/17.5',
} as const;

/** In-app web views on iOS, which have no such share menu. */
const IOS_IN_APP = {
  'the Google app':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/321.0.649069647 Mobile/15E148 Safari/604.1',
  Facebook:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1 [FBAN/FBIOS;FBAV/470.0.0.37.106;FBBV/625416307;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/de_DE;FBOP/5]',
  Instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1 Instagram 334.0.4.32.98 (iPhone14,5; iOS 17_5; de_DE; de; scale=3.00; 1170x2532; 610979035)',
} as const;

interface Browser {
  readonly userAgent?: string;
  readonly maxTouchPoints?: number;
  readonly standalone?: boolean;
  /** Whether `(display-mode: standalone)` matches. */
  readonly displayStandalone?: boolean;
  readonly storage?: Storage;
}

interface Setup {
  readonly hint: InstallHint;
  /** Fires `beforeinstallprompt`, whose `prompt` the spec can watch. */
  firePrompt(): ReturnType<typeof vi.fn<() => Promise<unknown>>>;
  install(): void;
  /** Fires `beforeinstallprompt` (answered once `userChoice` settles) and hands it back. */
  promptEvent(userChoice?: Promise<unknown>): Event;
}

function environmentOf(
  browser: Browser,
  target: EventTarget
): InstallEnvironment {
  const navigator: InstallNavigator = {
    userAgent: browser.userAgent ?? CHROME_ANDROID,
    maxTouchPoints: browser.maxTouchPoints ?? 5,
    ...(browser.standalone === undefined
      ? {}
      : { standalone: browser.standalone }),
  };
  const environment: InstallEnvironment = {
    browserWindow: {
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      matchMedia: (query: string) =>
        ({
          matches:
            query === '(display-mode: standalone)' &&
            browser.displayStandalone === true,
        }) as MediaQueryList,
    },
    navigator,
    storage: () => browser.storage,
  };
  return environment;
}

function firePromptOn(
  target: EventTarget
): ReturnType<typeof vi.fn<() => Promise<unknown>>> {
  const prompt = vi.fn<() => Promise<unknown>>(() => Promise.resolve());
  target.dispatchEvent(beforeInstallPrompt(prompt));
  return prompt;
}

/** A `beforeinstallprompt` as the browser fires it: cancelable. */
function beforeInstallPrompt(
  prompt: () => Promise<unknown> = () => Promise.resolve(),
  userChoice: Promise<unknown> = new Promise(() => undefined)
): Event {
  return Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice,
  });
}

function start(browser: Browser = {}): Setup {
  const target = new EventTarget();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: INSTALL_ENVIRONMENT,
        useValue: environmentOf(browser, target),
      },
    ],
  });
  const hint = TestBed.inject(InstallHint);
  return {
    hint,
    firePrompt: () => firePromptOn(target),
    install: () => target.dispatchEvent(new Event('appinstalled')),
    promptEvent: (userChoice) => {
      const event = beforeInstallPrompt(undefined, userChoice);
      target.dispatchEvent(event);
      return event;
    },
  };
}

describe('installOffer', () => {
  const SITUATION = {
    installed: false,
    dismissed: false,
    prompt: false,
    ios: false,
  };

  it("offers the browser's install dialog where it has one", () => {
    expect(installOffer({ ...SITUATION, prompt: true })).toBe('install');
  });

  it('explains the share menu on iOS', () => {
    expect(installOffer({ ...SITUATION, ios: true })).toBe('ios');
  });

  it('offers nothing where the browser has no way to install', () => {
    expect(installOffer(SITUATION)).toBe('none');
  });

  it('offers nothing once installed or dismissed', () => {
    for (const situation of [
      { ...SITUATION, prompt: true, ios: true, installed: true },
      { ...SITUATION, prompt: true, ios: true, dismissed: true },
    ]) {
      expect(installOffer(situation)).toBe('none');
    }
  });
});

describe('isIosWithShareMenu', () => {
  const device = (userAgent: string, maxTouchPoints = 5): InstallNavigator => ({
    userAgent,
    maxTouchPoints,
  });

  it("knows Safari on an iPhone, and on an iPad, which says it's a Mac", () => {
    expect(isIosWithShareMenu(device(SAFARI_IPHONE))).toBe(true);
    expect(isIosWithShareMenu(device(SAFARI_IPAD))).toBe(true);
  });

  it.each(Object.entries(OTHER_IOS_BROWSERS))(
    'takes another iOS browser too: %s',
    (_name, userAgent) => {
      expect(isIosWithShareMenu(device(userAgent))).toBe(true);
    }
  );

  it.each(Object.entries(IOS_IN_APP))(
    'takes no in-app view: %s',
    (_name, userAgent) => {
      expect(isIosWithShareMenu(device(userAgent))).toBe(false);
    }
  );

  it('takes another iOS browser only from iOS 16.4, Safari before it too', () => {
    const chrome = (version: string) =>
      `Mozilla/5.0 (iPhone; CPU iPhone OS ${version} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1`;
    const safari15 =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.1 Mobile/15E148 Safari/604.1';

    expect(isIosWithShareMenu(device(chrome('16_3')))).toBe(false);
    expect(isIosWithShareMenu(device(chrome('15_8_3')))).toBe(false);
    expect(isIosWithShareMenu(device(chrome('16_4')))).toBe(true);
    expect(isIosWithShareMenu(device(chrome('17_0_1')))).toBe(true);
    expect(isIosWithShareMenu(device(safari15))).toBe(true);
  });

  it('takes no plain web view of an app, which names no Safari', () => {
    const webView =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

    expect(isIosWithShareMenu(device(webView))).toBe(false);
  });

  it('takes no Mac without a touch screen, nor Android', () => {
    expect(isIosWithShareMenu(device(SAFARI_IPAD, 0))).toBe(false);
    expect(isIosWithShareMenu(device(CHROME_ANDROID))).toBe(false);
  });
});

describe('InstallHint', () => {
  it('hears the browser from the start of the app, before a page asks', async () => {
    const target = new EventTarget();
    TestBed.configureTestingModule({
      providers: [
        provideInstallHint(),
        { provide: INSTALL_ENVIRONMENT, useValue: environmentOf({}, target) },
      ],
    });
    await TestBed.inject(ApplicationInitStatus).donePromise;

    firePromptOn(target);

    expect(TestBed.inject(InstallHint).offer()).toBe('install');
  });

  it('offers nothing until the browser offers its install dialog', () => {
    const { hint, firePrompt } = start();
    expect(hint.offer()).toBe('none');

    firePrompt();

    expect(hint.offer()).toBe('install');
  });

  it("opens the browser's dialog once, then hides the hint", async () => {
    const { hint, firePrompt } = start();
    const prompt = firePrompt();

    await hint.install();
    await hint.install();

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(hint.offer()).toBe('none');
  });

  it('settles where the browser refuses its dialog, the hint gone until it offers it again', async () => {
    const { hint, firePrompt } = start();
    const prompt = firePrompt();
    prompt.mockRejectedValue(
      new DOMException('prompt() can only be called once', 'InvalidStateError')
    );

    await expect(hint.install()).resolves.toBeUndefined();

    expect(hint.offer()).toBe('none');
    firePrompt();
    expect(hint.offer()).toBe('install');
  });

  it("drops an event the parent answered in the browser's own dialog", async () => {
    const { hint, promptEvent } = start();
    const answer = Promise.withResolvers<unknown>();
    promptEvent(answer.promise);
    expect(hint.offer()).toBe('install');

    answer.resolve({ outcome: 'dismissed', platform: '' });
    await answer.promise;
    await Promise.resolve();

    expect(hint.offer()).toBe('none');
  });

  it('hides the hint once the app was installed', () => {
    const { hint, firePrompt, install } = start();
    firePrompt();

    install();

    expect(hint.offer()).toBe('none');
  });

  it('explains the share menu on iOS', () => {
    const { hint } = start({ userAgent: SAFARI_IPHONE });

    expect(hint.offer()).toBe('ios');
  });

  describe("the browser's own install offer", () => {
    it('is taken over while a page shows the hint', () => {
      const { hint, promptEvent } = start();
      hint.show();

      expect(promptEvent().defaultPrevented).toBe(true);
    });

    it('is left alone while no page shows the hint, yet offered once one does', () => {
      const { hint, promptEvent } = start();

      expect(promptEvent().defaultPrevented).toBe(false);

      hint.show();
      expect(hint.offer()).toBe('install');
    });

    it('is left alone once the page showing the hint is gone', () => {
      const { hint, promptEvent } = start();
      const leave = hint.show();

      leave();

      expect(promptEvent().defaultPrevented).toBe(false);
    });

    it('is left alone once the hint was dismissed', () => {
      const device = mapStorage();
      device.setItem(INSTALL_DISMISSED_KEY, '1');
      const { hint, promptEvent } = start({ storage: device });
      hint.show();

      expect(promptEvent().defaultPrevented).toBe(false);
    });
  });

  describe('where the app already runs installed', () => {
    it('offers nothing in the display mode of an installed app', () => {
      const { hint, firePrompt } = start({ displayStandalone: true });

      firePrompt();

      expect(hint.offer()).toBe('none');
    });

    it('offers nothing in Safari opened from the home screen', () => {
      const { hint } = start({
        userAgent: SAFARI_IPHONE,
        standalone: true,
      });

      expect(hint.offer()).toBe('none');
    });
  });

  describe('dismissed', () => {
    it('hides the hint and remembers it on the device', () => {
      const device = mapStorage();
      const { hint, firePrompt } = start({ storage: device });
      firePrompt();

      hint.dismiss();

      expect(hint.offer()).toBe('none');
      expect(device.getItem(INSTALL_DISMISSED_KEY)).toBe('1');
    });

    it('stays hidden at the next start', () => {
      const device = mapStorage();
      device.setItem(INSTALL_DISMISSED_KEY, '1');
      const { hint, firePrompt } = start({
        userAgent: SAFARI_IPHONE,
        storage: device,
      });

      firePrompt();

      expect(hint.offer()).toBe('none');
    });

    it('hides the hint for the visit where the device keeps nothing', () => {
      const { hint, firePrompt } = start({
        storage: BLOCKED_STORAGE,
      });
      firePrompt();
      expect(hint.offer()).toBe('install');

      hint.dismiss();

      expect(hint.offer()).toBe('none');
    });
  });
});
