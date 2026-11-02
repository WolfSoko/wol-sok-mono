/**
 * What the Bacteria Wars pictures share: the colours of the two colonies and
 * the petri dish of the app icon, as SVG fragments. generate-icons.ts draws
 * the app icon with them, generate-achievement-icons.ts the badge of every
 * achievement, so a new palette reaches both.
 */

/** The colours of a colony: its territory, its cells and its glowing edge. */
export interface ColonyColors {
  base: string;
  /** Highlight, body and rim colour of a cell. */
  cell: [string, string, string];
  /** Glow along the colony's edge at the front. */
  edge: string;
}

export const ORANGE: ColonyColors = {
  base: '#c64200',
  cell: ['#ffd08a', '#ff8a2a', '#e25400'],
  edge: '#ffb15c',
};

export const BLUE: ColonyColors = {
  base: '#0636a0',
  cell: ['#a8e0ff', '#2f8cff', '#0a52d0'],
  edge: '#6cc4ff',
};

/** The gradients of the dish: its agar, its glass rim and the shade at its edge. */
export const DISH_DEFS = `<radialGradient id="agar" cx="50%" cy="45%" r="55%">
      <stop offset="0" stop-color="#10233b"/>
      <stop offset="1" stop-color="#060e19"/>
    </radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.8"/>
      <stop offset="0.5" stop-color="#9fc4ff" stop-opacity="0.15"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.5"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="50%">
      <stop offset="0.75" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.45"/>
    </radialGradient>`;

/** The agar of a dish of radius r around (c, c), to draw on. */
export function dishAgar(c: number, r: number): string {
  return `<circle cx="${c}" cy="${c}" r="${r}" fill="url(#agar)"/>`;
}

/** The shade and the glass rim of that dish, over what is drawn on it. */
export function dishRim(c: number, r: number): string {
  return `<circle cx="${c}" cy="${c}" r="${r}" fill="url(#vignette)"/>
  <circle cx="${c}" cy="${c}" r="${r - 5}" fill="none" stroke="url(#rim)" stroke-width="10"/>`;
}
