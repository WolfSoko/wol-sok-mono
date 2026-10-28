import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  let matches = false;

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches }),
    });
    document.head.innerHTML = '<meta name="theme-color" content="" />';
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  function create(): ThemeService {
    TestBed.configureTestingModule({});
    const theme = TestBed.inject(ThemeService);
    TestBed.tick();
    return theme;
  }

  function themeColor(): string | null {
    return document
      .querySelector('meta[name="theme-color"]')
      ?.getAttribute('content') as string | null;
  }

  it('follows the system by default and tells the browser chrome', () => {
    matches = true;
    create();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(themeColor()).toBe('#0b0f14');
  });

  it('pins a stored choice on the root element', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const theme = create();
    expect(theme.choice()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(themeColor()).toBe('#f6f8fb');
  });

  it('cycles system, light, dark and stores the choice', () => {
    const theme = create();
    theme.cycle();
    TestBed.tick();
    expect(theme.choice()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    theme.cycle();
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(themeColor()).toBe('#0b0f14');

    theme.cycle();
    TestBed.tick();
    expect(theme.choice()).toBe('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
