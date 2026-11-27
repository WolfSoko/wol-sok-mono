import type { Rgb } from './renderer';

/** the colour the dots take when the host's colour cannot be read */
export const FALLBACK_DOT_COLOR: Rgb = { r: 128, g: 128, b: 128 };

const RGB_FUNCTION = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i;

/** reads `rgb(…)`/`rgba(…)`, as `getComputedStyle` gives most colours */
export function parseRgbFunction(cssColor: string): Rgb | null {
  const match = RGB_FUNCTION.exec(cssColor.trim());
  if (match == null) {
    return null;
  }
  const [r, g, b] = match.slice(1, 4).map((channel) => clampChannel(+channel));
  return { r, g, b };
}

function clampChannel(value: number): number {
  return Math.round(Math.min(255, Math.max(0, value)));
}

/**
 * Turns any computed CSS colour into channels: `rgb()` directly, others
 * (`oklch()`, `color()`, …) by painting one pixel with a 2D canvas.
 */
export function cssColorToRgb(
  cssColor: string,
  createCanvas: () => HTMLCanvasElement
): Rgb {
  const parsed = parseRgbFunction(cssColor);
  if (parsed != null) {
    return parsed;
  }
  const canvas = createCanvas();
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context == null) {
    return FALLBACK_DOT_COLOR;
  }
  context.fillStyle = cssColor;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return { r, g, b };
}

/**
 * The colour `color` (any CSS colour, variables included) has inside `host`;
 * the host's own `currentColor` without one.
 */
export function resolveDotColor(
  host: HTMLElement,
  color: string | undefined,
  createCanvas: () => HTMLCanvasElement
): Rgb {
  const view = host.ownerDocument.defaultView;
  if (view == null) {
    return FALLBACK_DOT_COLOR;
  }
  const probe = host.ownerDocument.createElement('span');
  probe.style.display = 'none';
  probe.style.color = color ?? 'currentColor';
  host.appendChild(probe);
  const computed = view.getComputedStyle(probe).color;
  probe.remove();
  return cssColorToRgb(computed, createCanvas);
}
