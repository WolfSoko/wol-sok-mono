import { dismissSplash, SPLASH_ID } from './splash';

describe('dismissSplash', () => {
  afterEach(() => jest.useRealTimers());

  it('fades the loading screen out, then takes it away', () => {
    jest.useFakeTimers();
    const splash = document.createElement('div');
    splash.id = SPLASH_ID;
    document.body.append(splash);

    dismissSplash(document);

    expect(splash.classList.contains('done')).toBe(true);
    expect(document.getElementById(SPLASH_ID)).not.toBeNull();
    jest.runAllTimers();
    expect(document.getElementById(SPLASH_ID)).toBeNull();
  });

  it('does nothing without one', () => {
    expect(() => dismissSplash(document)).not.toThrow();
  });
});
