import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  INSTALLATION_ABGELEHNT_SCHLUESSEL,
  INSTALLATIONS_UMGEBUNG,
  InstallationsHinweis,
  installationsAngebot,
  istIosSafari,
  provideInstallationsHinweis,
  type InstallationsNavigator,
  type InstallationsUmgebung,
} from './installations-hinweis';

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const CHROME_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1';
const SAFARI_IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';

/** A Storage on a Map, as `localStorage` behaves. */
function speicher(): Storage {
  const werte = new Map<string, string>();
  return {
    get length() {
      return werte.size;
    },
    clear: () => werte.clear(),
    getItem: (key) => werte.get(key) ?? null,
    key: (index) => [...werte.keys()][index] ?? null,
    removeItem: (key) => werte.delete(key),
    setItem: (key, value) => werte.set(key, value),
  };
}

/** A Storage the browser blocks: every access throws. */
const GESPERRT: Storage = {
  length: 0,
  clear: () => undefined,
  getItem: () => {
    throw new DOMException('blocked', 'SecurityError');
  },
  key: () => null,
  removeItem: () => undefined,
  setItem: () => {
    throw new DOMException('blocked', 'SecurityError');
  },
};

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
  ziel.dispatchEvent(
    Object.assign(new Event('beforeinstallprompt'), { prompt })
  );
  return prompt;
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
  };
}

describe('installationsAngebot', () => {
  const LAGE = {
    installiert: false,
    abgelehnt: false,
    aufforderung: false,
    iosSafari: false,
  };

  it("offers the browser's install dialog where it has one", () => {
    expect(installationsAngebot({ ...LAGE, aufforderung: true })).toBe(
      'installieren'
    );
  });

  it("explains Safari's share menu on iOS", () => {
    expect(installationsAngebot({ ...LAGE, iosSafari: true })).toBe('ios');
  });

  it('offers nothing where the browser has no way to install', () => {
    expect(installationsAngebot(LAGE)).toBe('keins');
  });

  it('offers nothing once installed or dismissed', () => {
    for (const lage of [
      { ...LAGE, aufforderung: true, iosSafari: true, installiert: true },
      { ...LAGE, aufforderung: true, iosSafari: true, abgelehnt: true },
    ]) {
      expect(installationsAngebot(lage)).toBe('keins');
    }
  });
});

describe('istIosSafari', () => {
  const geraet = (
    userAgent: string,
    maxTouchPoints = 5
  ): InstallationsNavigator => ({ userAgent, maxTouchPoints });

  it("knows Safari on an iPhone, and on an iPad, which says it's a Mac", () => {
    expect(istIosSafari(geraet(SAFARI_IPHONE))).toBe(true);
    expect(istIosSafari(geraet(SAFARI_IPAD))).toBe(true);
  });

  it('takes no Mac without a touch screen, nor another browser on iOS', () => {
    expect(istIosSafari(geraet(SAFARI_IPAD, 0))).toBe(false);
    expect(istIosSafari(geraet(CHROME_IPHONE))).toBe(false);
    expect(istIosSafari(geraet(CHROME_ANDROID))).toBe(false);
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

  it('hides the hint once the app was installed', () => {
    const { hinweis, auffordern, installieren } = starten();
    auffordern();

    installieren();

    expect(hinweis.angebot()).toBe('keins');
  });

  it('explains the share menu in Safari on iOS', () => {
    const { hinweis } = starten({ userAgent: SAFARI_IPHONE });

    expect(hinweis.angebot()).toBe('ios');
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
      const geraet = speicher();
      const { hinweis, auffordern } = starten({ speicher: geraet });
      auffordern();

      hinweis.ablehnen();

      expect(hinweis.angebot()).toBe('keins');
      expect(geraet.getItem(INSTALLATION_ABGELEHNT_SCHLUESSEL)).not.toBeNull();
    });

    it('stays hidden at the next start', () => {
      const geraet = speicher();
      geraet.setItem(INSTALLATION_ABGELEHNT_SCHLUESSEL, '1');
      const { hinweis, auffordern } = starten({
        userAgent: SAFARI_IPHONE,
        speicher: geraet,
      });

      auffordern();

      expect(hinweis.angebot()).toBe('keins');
    });

    it('hides the hint for the visit where the device keeps nothing', () => {
      const { hinweis, auffordern } = starten({ speicher: GESPERRT });
      auffordern();
      expect(hinweis.angebot()).toBe('installieren');

      hinweis.ablehnen();

      expect(hinweis.angebot()).toBe('keins');
    });
  });
});
