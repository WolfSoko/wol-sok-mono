import { Localized } from '../i18n/language';

/** A picture of an article: an SVG file below `public/`, with its texts. */
export interface BlogFigure {
  /** Its path on the site, such as `/blog/<slug>/nat-walls.svg`. */
  readonly src: string;
  /** Its intrinsic size, so the page does not shift while it loads. */
  readonly width: number;
  readonly height: number;
  readonly alt: Localized;
  readonly caption: Localized;
}
