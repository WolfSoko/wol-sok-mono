import {
  ACHIEVEMENT_ICON_IDS,
  ACHIEVEMENT_ICON_SIZE,
  achievementIconDataUrl,
  achievementIconSvg,
} from './achievement-icons';

describe('achievement icons', () => {
  it.each(ACHIEVEMENT_ICON_IDS)(
    'draws %s as one SVG of the icon size',
    (id) => {
      const svg = achievementIconSvg(id);

      expect(svg.startsWith('<svg ')).toBe(true);
      expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
      expect(svg.match(/<svg[\s>]/g)).toHaveLength(1);
      expect(svg).toContain(
        `viewBox="0 0 ${ACHIEVEMENT_ICON_SIZE} ${ACHIEVEMENT_ICON_SIZE}"`
      );
      expect(svg).not.toContain('undefined');
    }
  );

  // An SVG in an <img> loads nothing and gets no web font: an icon that
  // needs either would not look like its PNG in Play Games.
  it.each(ACHIEVEMENT_ICON_IDS)(
    'keeps %s self-contained: no text, image or outside reference',
    (id) => {
      const svg = achievementIconSvg(id);

      expect(svg).not.toMatch(/<(text|image|use|foreignObject|style)\b/);
      expect(svg).not.toMatch(/href=/);
      expect(svg).not.toMatch(/url\((?!#)/);
    }
  );

  it('refers only to gradients and filters the icon defines itself', () => {
    for (const id of ACHIEVEMENT_ICON_IDS) {
      const svg = achievementIconSvg(id);
      const defined = new Set(
        [...svg.matchAll(/ id="([^"]+)"/g)].map(([, name]) => name)
      );
      for (const [, name] of svg.matchAll(/url\(#([^)]+)\)/g)) {
        expect(defined).toContain(name);
      }
    }
  });

  it('turns an icon into a data URL that decodes back to its SVG', () => {
    const url = achievementIconDataUrl('blitz');
    const prefix = 'data:image/svg+xml;charset=utf-8,';

    expect(url.startsWith(prefix)).toBe(true);
    expect(url).not.toMatch(/[#<>"\s]/);
    expect(decodeURIComponent(url.slice(prefix.length))).toBe(
      achievementIconSvg('blitz')
    );
  });

  it('refuses an id without an icon', () => {
    expect(() => achievementIconSvg('no-such-achievement')).toThrow(
      'No icon for the achievement no-such-achievement'
    );
  });
});
