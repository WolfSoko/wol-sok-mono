import { TestBed } from '@angular/core/testing';
import { provideTheme, type ThemeSettings } from './provide-theme';
import { ThemeService } from './theme.service';

const KEY = 'test.theme';
const COLORS = { light: '#f6f8fb', dark: '#0b0f14' } as const;

describe('ThemeService', () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="theme-color" content="#e37100" media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="#e37100" media="(prefers-color-scheme: dark)" />`;
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
    document.documentElement.removeAttribute('data-theme');
  });

  function create(
    settings: ThemeSettings = { storageKey: KEY, themeColors: COLORS }
  ): ThemeService {
    TestBed.configureTestingModule({ providers: [provideTheme(settings)] });
    const theme = TestBed.inject(ThemeService);
    TestBed.tick();
    return theme;
  }

  function themeColors(): string[] {
    return [...document.querySelectorAll('meta[name="theme-color"]')].map(
      (meta) => meta.getAttribute('content') ?? ''
    );
  }

  it('follows the system by default, each meta with its own colour', () => {
    const theme = create();
    expect(theme.choice()).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(themeColors()).toEqual([COLORS.light, COLORS.dark]);
  });

  it('pins a stored choice on the root element and both metas', () => {
    localStorage.setItem(KEY, 'light');
    const theme = create();
    expect(theme.choice()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(themeColors()).toEqual([COLORS.light, COLORS.light]);
  });

  it('takes an unknown stored value for the system', () => {
    localStorage.setItem(KEY, 'purple');
    expect(create().choice()).toBe('system');
  });

  it('cycles system, light, dark and stores the choice', () => {
    const theme = create();
    theme.cycle();
    TestBed.tick();
    expect(theme.choice()).toBe('light');
    expect(localStorage.getItem(KEY)).toBe('light');

    theme.cycle();
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(themeColors()).toEqual([COLORS.dark, COLORS.dark]);

    theme.cycle();
    TestBed.tick();
    expect(theme.choice()).toBe('system');
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('chooses a theme directly and stores it', () => {
    const theme = create();
    theme.choose('dark');
    TestBed.tick();
    expect(theme.choice()).toBe('dark');
    expect(localStorage.getItem(KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    theme.choose('system');
    TestBed.tick();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('leaves the theme-color metas alone without theme colours', () => {
    const theme = create({ storageKey: KEY });
    theme.choose('dark');
    TestBed.tick();
    expect(themeColors()).toEqual(['#e37100', '#e37100']);
  });

  it('names provideTheme where an app left it out', () => {
    TestBed.configureTestingModule({});
    expect(() => TestBed.inject(ThemeService)).toThrow(/provideTheme/);
  });

  it('keeps the choice for the visit where storage is blocked', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const theme = create();
    theme.choose('light');
    TestBed.tick();
    expect(theme.choice()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
