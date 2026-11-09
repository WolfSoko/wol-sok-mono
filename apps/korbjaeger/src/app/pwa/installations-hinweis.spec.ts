import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  INSTALLATIONS_UMGEBUNG,
  InstallationsHinweis,
  installationsAngebot,
  istIosMitTeilenMenue,
  provideInstallationsHinweis,
  type InstallationsNavigator,
  type InstallationsUmgebung,
} from './installations-hinweis';
import { INSTALLATION_ABGELEHNT_SCHLUESSEL } from '../geraete-speicher';
import { GESPERRTER_SPEICHER, mapSpeicher } from '../../testing/speicher';

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const CHROME_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1';
const SAFARI_IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';

/** Other iOS browsers, whose share menu has "Zum Home-Bildschirm" since iOS 16.4. */
const ANDERE_IOS_BROWSER = {
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
  readonly speicher?: Storage;
}

interface Aufbau {
  readonly hinweis: InstallationsHinweis;
  /** Fires `beforeinstallprompt`, whose `prompt` the spec can watch. */
  auffordern(): ReturnType<typeof vi.fn<() => Promise<unknown>>>;
  installieren(): void;
  /** Fires `beforeinstallprompt` and hands it back. */
  aufforderungsEreignis(): Event;
}

function umgebungVon(
  browser: Browser,
  ziel: EventTarget
): InstallationsUmgebung {
  const navigator: InstallationsNavigator = {
    userAgent: browser.userAgent ?? CHROME_ANDROID,
    maxTouchPoints: browser.maxTouchPoints ?? 5,
    ...(browser.standalone === undefined
      ? {}
      : { standalone: browser.standalone }),
  };
  const umgebung: InstallationsUmgebung = {
    fenster: {
      addEventListener: ziel.addEventListener.bind(ziel),
      removeEventListener: ziel.removeEventListener.bind(ziel),
      matchMedia: (query: string) =>
        ({
          matches:
            query === '(display-mode: standalone)' &&
            browser.displayStandalone === true,
        }) as MediaQueryList,
    },
    navigator,
    speicher: () => browser.speicher,
  };
  return umgebung;
}

function auffordernAuf(
  ziel: EventTarget
): ReturnType<typeof vi.fn<() => Promise<unknown>>> {
  const prompt = vi.fn<() => Promise<unknown>>(() => Promise.resolve());
  ziel.dispatchEvent(ereignis(prompt));
  return prompt;
}

/** A `beforeinstallprompt` as the browser fires it: cancelable. */
function ereignis(
  prompt: () => Promise<unknown> = () => Promise.resolve()
): Event {
  return Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
  });
}

function starten(browser: Browser = {}): Aufbau {
  const ziel = new EventTarget();
  TestBed.configureTestingModule({
    providers: [
      { provide: INSTALLATIONS_UMGEBUNG, useValue: umgebungVon(browser, ziel) },
    ],
  });
  const hinweis = TestBed.inject(InstallationsHinweis);
  return {
    hinweis,
    auffordern: () => auffordernAuf(ziel),
    installieren: () => ziel.dispatchEvent(new Event('appinstalled')),
    aufforderungsEreignis: () => {
      const event = ereignis();
      ziel.dispatchEvent(event);
      return event;
    },
  };
}

describe('installationsAngebot', () => {
  const LAGE = {
    installiert: false,
    abgelehnt: false,
    aufforderung: false,
    ios: false,
  };

  it("offers the browser's install dialog where it has one", () => {
    expect(installationsAngebot({ ...LAGE, aufforderung: true })).toBe(
      'installieren'
    );
  });

  it('explains the share menu on iOS', () => {
    expect(installationsAngebot({ ...LAGE, ios: true })).toBe('ios');
  });

  it('offers nothing where the browser has no way to install', () => {
    expect(installationsAngebot(LAGE)).toBe('keins');
  });

  it('offers nothing once installed or dismissed', () => {
    for (const lage of [
      { ...LAGE, aufforderung: true, ios: true, installiert: true },
      { ...LAGE, aufforderung: true, ios: true, abgelehnt: true },
    ]) {
      expect(installationsAngebot(lage)).toBe('keins');
    }
  });
});

describe('istIosMitTeilenMenue', () => {
  const geraet = (
    userAgent: string,
    maxTouchPoints = 5
  ): InstallationsNavigator => ({ userAgent, maxTouchPoints });

  it("knows Safari on an iPhone, and on an iPad, which says it's a Mac", () => {
    expect(istIosMitTeilenMenue(geraet(SAFARI_IPHONE))).toBe(true);
    expect(istIosMitTeilenMenue(geraet(SAFARI_IPAD))).toBe(true);
  });

  it.each(Object.entries(ANDERE_IOS_BROWSER))(
    'takes another iOS browser too: %s',
    (_name, userAgent) => {
      expect(istIosMitTeilenMenue(geraet(userAgent))).toBe(true);
    }
  );

  it.each(Object.entries(IOS_IN_APP))(
    'takes no in-app view: %s',
    (_name, userAgent) => {
      expect(istIosMitTeilenMenue(geraet(userAgent))).toBe(false);
    }
  );

  it('takes no Mac without a touch screen, nor Android', () => {
    expect(istIosMitTeilenMenue(geraet(SAFARI_IPAD, 0))).toBe(false);
    expect(istIosMitTeilenMenue(geraet(CHROME_ANDROID))).toBe(false);
  });
});

describe('InstallationsHinweis', () => {
  it('hears the browser from the start of the app, before a page asks', async () => {
    const ziel = new EventTarget();
    TestBed.configureTestingModule({
      providers: [
        provideInstallationsHinweis(),
        { provide: INSTALLATIONS_UMGEBUNG, useValue: umgebungVon({}, ziel) },
      ],
    });
    await TestBed.inject(ApplicationInitStatus).donePromise;

    auffordernAuf(ziel);

    expect(TestBed.inject(InstallationsHinweis).angebot()).toBe('installieren');
  });

  it('offers nothing until the browser offers its install dialog', () => {
    const { hinweis, auffordern } = starten();
    expect(hinweis.angebot()).toBe('keins');

    auffordern();

    expect(hinweis.angebot()).toBe('installieren');
  });

  it("opens the browser's dialog once, then hides the hint", async () => {
    const { hinweis, auffordern } = starten();
    const prompt = auffordern();

    await hinweis.installieren();
    await hinweis.installieren();

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(hinweis.angebot()).toBe('keins');
  });

  it('settles where the browser refuses its dialog, the hint gone until it offers it again', async () => {
    const { hinweis, auffordern } = starten();
    const prompt = auffordern();
    prompt.mockRejectedValue(
      new DOMException('prompt() can only be called once', 'InvalidStateError')
    );

    await expect(hinweis.installieren()).resolves.toBeUndefined();

    expect(hinweis.angebot()).toBe('keins');
    auffordern();
    expect(hinweis.angebot()).toBe('installieren');
  });

  it('hides the hint once the app was installed', () => {
    const { hinweis, auffordern, installieren } = starten();
    auffordern();

    installieren();

    expect(hinweis.angebot()).toBe('keins');
  });

  it('explains the share menu on iOS', () => {
    const { hinweis } = starten({ userAgent: SAFARI_IPHONE });

    expect(hinweis.angebot()).toBe('ios');
  });

  describe("the browser's own install offer", () => {
    it('is taken over while a page shows the hint', () => {
      const { hinweis, aufforderungsEreignis } = starten();
      hinweis.anzeigen();

      expect(aufforderungsEreignis().defaultPrevented).toBe(true);
    });

    it('is left alone while no page shows the hint, yet offered once one does', () => {
      const { hinweis, aufforderungsEreignis } = starten();

      expect(aufforderungsEreignis().defaultPrevented).toBe(false);

      hinweis.anzeigen();
      expect(hinweis.angebot()).toBe('installieren');
    });

    it('is left alone once the page showing the hint is gone', () => {
      const { hinweis, aufforderungsEreignis } = starten();
      const verlassen = hinweis.anzeigen();

      verlassen();

      expect(aufforderungsEreignis().defaultPrevented).toBe(false);
    });

    it('is left alone once the hint was dismissed', () => {
      const geraet = mapSpeicher();
      geraet.setItem(INSTALLATION_ABGELEHNT_SCHLUESSEL, '1');
      const { hinweis, aufforderungsEreignis } = starten({ speicher: geraet });
      hinweis.anzeigen();

      expect(aufforderungsEreignis().defaultPrevented).toBe(false);
    });
  });

  describe('where the app already runs installed', () => {
    it('offers nothing in the display mode of an installed app', () => {
      const { hinweis, auffordern } = starten({ displayStandalone: true });

      auffordern();

      expect(hinweis.angebot()).toBe('keins');
    });

    it('offers nothing in Safari opened from the home screen', () => {
      const { hinweis } = starten({
        userAgent: SAFARI_IPHONE,
        standalone: true,
      });

      expect(hinweis.angebot()).toBe('keins');
    });
  });

  describe('dismissed', () => {
    it('hides the hint and remembers it on the device', () => {
      const geraet = mapSpeicher();
      const { hinweis, auffordern } = starten({ speicher: geraet });
      auffordern();

      hinweis.ablehnen();

      expect(hinweis.angebot()).toBe('keins');
      expect(geraet.getItem(INSTALLATION_ABGELEHNT_SCHLUESSEL)).not.toBeNull();
    });

    it('stays hidden at the next start', () => {
      const geraet = mapSpeicher();
      geraet.setItem(INSTALLATION_ABGELEHNT_SCHLUESSEL, '1');
      const { hinweis, auffordern } = starten({
        userAgent: SAFARI_IPHONE,
        speicher: geraet,
      });

      auffordern();

      expect(hinweis.angebot()).toBe('keins');
    });

    it('hides the hint for the visit where the device keeps nothing', () => {
      const { hinweis, auffordern } = starten({
        speicher: GESPERRTER_SPEICHER,
      });
      auffordern();
      expect(hinweis.angebot()).toBe('installieren');

      hinweis.ablehnen();

      expect(hinweis.angebot()).toBe('keins');
    });
  });
});
