import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { THEME_COLORS, THEME_STORAGE_KEY } from './theme';

describe('the portfolio theme', () => {
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
    expect(html).toContain(`"${THEME_COLORS.dark}"`);
    expect(html).toContain(`"${THEME_COLORS.light}"`);
  });
});
