import type { Level } from '../navigation/breadcrumb';

/** The search's level in the breadcrumb of a page below it. */
export const SEARCH_LEVEL: Level = { title: 'Suchen', link: ['/suchen'] };

/** The search "Über mein Kind", below `SEARCH_LEVEL`. */
export const CHILD_SEARCH_LEVEL: Level = {
  title: 'Mein Kind',
  link: ['/suchen/kind'],
};
