import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { THEME_COLORS, THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="theme-color" content="" media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="" media="(prefers-color-scheme: dark)" />`;
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

  function themeColors(): string[] {
    return [...document.querySelectorAll('meta[name="theme-color"]')].map(
      (meta) => meta.getAttribute('content') ?? ''
    );
  }

  it('follows the system by default, each meta with its own colour', () => {
    create();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(themeColors()).toEqual([THEME_COLORS.light, THEME_COLORS.dark]);
  });

  it('pins a stored choice on the root element and both metas', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const theme = create();
    expect(theme.choice()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(themeColors()).toEqual([THEME_COLORS.light, THEME_COLORS.light]);
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
    expect(themeColors()).toEqual([THEME_COLORS.dark, THEME_COLORS.dark]);

    theme.cycle();
    TestBed.tick();
    expect(theme.choice()).toBe('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('shares its key and colours with the script in index.html', () => {
    const html = readFileSync(join(__dirname, '../../index.html'), 'utf8');
    const metas = [...html.matchAll(/<meta\s+name="theme-color"([^>]*)>/g)].map(
      ([, attributes]) => attributes.replace(/\s+/g, ' ')
    );
    expect(html).toContain(`localStorage.getItem("${THEME_STORAGE_KEY}")`);
    expect(metas).toEqual([
      ` media="(prefers-color-scheme: light)" content="${THEME_COLORS.light}" /`,
      ` media="(prefers-color-scheme: dark)" content="${THEME_COLORS.dark}" /`,
    ]);
    expect(html).toContain(`'${THEME_COLORS.dark}'`.replace(/'/g, '"'));
    expect(html).toContain(`'${THEME_COLORS.light}'`.replace(/'/g, '"'));
  });
});
