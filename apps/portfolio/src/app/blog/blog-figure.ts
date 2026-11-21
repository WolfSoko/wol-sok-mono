import { Localized } from '../i18n/language';

/** A picture of an article: an SVG file below `public/`, with its texts. */
export interface BlogFigure {
  /**
   * Its path on the site in each language (`/blog/<slug>/nat-walls.svg`,
   * `…/nat-walls.de.svg`): the sentences inside a picture are translated too.
   */
  readonly src: Localized;
  /** Its intrinsic size, so the page does not shift while it loads. */
  readonly width: number;
  readonly height: number;
  readonly alt: Localized;
  readonly caption: Localized;
}

/** A picture of a post below `public/blog/<slug>/`, as `<name>.svg` and `<name>.de.svg`. */
export function figureSources(slug: string, name: string): Localized {
  const base = `/blog/${slug}/${name}`;
  return { en: `${base}.svg`, de: `${base}.de.svg` };
}
