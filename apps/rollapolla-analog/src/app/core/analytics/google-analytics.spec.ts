import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideGoogleAnalytics } from './google-analytics';

const MEASUREMENT_ID = 'G-TEST123';
const SCRIPT_SELECTOR =
  'script[src^="https://www.googletagmanager.com/gtag/js"]';

type GtagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

describe('provideGoogleAnalytics', () => {
  afterEach(() => {
    const window = globalThis as unknown as GtagWindow;
    delete window.dataLayer;
    delete window.gtag;
    document.querySelectorAll(SCRIPT_SELECTOR).forEach((el) => el.remove());
  });

  function setup(
    measurementId: string | undefined,
    providers: Provider[] = []
  ): Document {
    TestBed.configureTestingModule({
      providers: [provideGoogleAnalytics(measurementId), ...providers],
    });
    return TestBed.inject(DOCUMENT);
  }

  it('loads gtag.js for the measurement id and configures it', () => {
    const document = setup(MEASUREMENT_ID);

    const script =
      document.head.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);
    expect(script?.src).toBe(
      `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
    );
    expect(script?.async).toBe(true);

    const dataLayer = (document.defaultView as GtagWindow).dataLayer ?? [];
    expect(dataLayer).toHaveLength(2);
    expect(Array.from(dataLayer[0] as ArrayLike<unknown>)).toEqual([
      'js',
      expect.any(Date),
    ]);
    expect(Array.from(dataLayer[1] as ArrayLike<unknown>)).toEqual([
      'config',
      MEASUREMENT_ID,
    ]);
  });

  it('pushes arguments objects, which is what gtag.js reads', () => {
    const document = setup(MEASUREMENT_ID);

    const dataLayer = (document.defaultView as GtagWindow).dataLayer ?? [];
    expect(Object.prototype.toString.call(dataLayer[0])).toBe(
      '[object Arguments]'
    );
  });

  it('loads nothing without a measurement id', () => {
    const document = setup(undefined);

    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
    expect((document.defaultView as GtagWindow).dataLayer).toBeUndefined();
  });

  it('loads nothing on the server', () => {
    const document = setup(MEASUREMENT_ID, [
      { provide: PLATFORM_ID, useValue: 'server' },
    ]);

    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
    expect((document.defaultView as GtagWindow).dataLayer).toBeUndefined();
  });
});
