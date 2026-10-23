import type { Rgb } from '../arena/arena-theme';
import { mix, rgba } from '../arena/canvas-math';

/**
 * The purchase moment of the Evolution screen, played on the DOM with the
 * Web Animations API: strands of DNA fly from the counter into what was
 * bought, which bursts with light and a shockwave while the screen flashes
 * and shakes. Nothing of it for players who ask for less motion, nor where
 * the browser cannot animate - the purchase itself never waits on it.
 */

/** True when the player asks for less motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export interface Celebration {
  /** Where the strands fly from - the DNA counter. */
  from: Element;
  /** Where they land - the level's pip, the weapon's card. */
  to: Element;
  /** The colour of what was bought. */
  color: Rgb;
  /** True for a gene just bred to the top: gold, and more of everything. */
  maxed?: boolean;
}

/** How many strands fly per purchase. */
const STRANDS = 14;
const GOLD: Rgb = [255, 214, 110];
const WHITE: Rgb = [255, 255, 255];

/**
 * Plays a purchase inside `layer` - an element laid over the screen that
 * scrolls with it - and shakes `stage`. Resolves as the strands land, at
 * once where nothing is played.
 */
export async function celebrate(
  layer: HTMLElement,
  stage: HTMLElement,
  { from, to, color, maxed = false }: Celebration
): Promise<void> {
  if (prefersReducedMotion() || typeof layer.animate !== 'function') {
    return;
  }
  const box = layer.getBoundingClientRect();
  const start = centerOf(from, box);
  const end = centerOf(to, box);
  const strands = Array.from({ length: STRANDS }, (_, index) =>
    flyStrand(layer, start, end, color, index)
  );
  await Promise.all(strands.map(finished));
  burst(layer, end, maxed ? GOLD : color, maxed);
  glow(to, maxed ? GOLD : color);
  flashAndShake(stage, maxed);
}

interface Point {
  x: number;
  y: number;
}

function centerOf(element: Element, box: DOMRect): Point {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - box.left,
    y: rect.top + rect.height / 2 - box.top,
  };
}

/** A dot placed in the layer, styled inline - the screen's styles do not reach it. */
function dot(layer: HTMLElement, at: Point, size: number, css: string) {
  const element = layer.ownerDocument.createElement('span');
  element.style.cssText =
    `position: absolute; left: ${at.x - size / 2}px; top: ${at.y - size / 2}px;` +
    `width: ${size}px; height: ${size}px; border-radius: 50%;` +
    `pointer-events: none; will-change: transform, opacity; ${css}`;
  layer.appendChild(element);
  return element;
}

/**
 * One strand: a glowing pair of bases curving from the counter to the
 * target, each on a path of its own, the later ones a little behind.
 */
function flyStrand(
  layer: HTMLElement,
  start: Point,
  end: Point,
  color: Rgb,
  index: number
): Animation {
  const light = mix(color, WHITE, 0.45);
  const element = dot(
    layer,
    start,
    9,
    `background: radial-gradient(circle, ${rgba(WHITE)} 0 25%, ${rgba(light)} 45%, ${rgba(color, 0)} 75%);` +
      `box-shadow: 0 0 10px 3px ${rgba(color, 0.8)}`
  );
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  // Away from the straight line, to either side.
  const bend = (index % 2 === 0 ? 1 : -1) * (40 + ((index * 37) % 90));
  const nx = (-dy / length) * bend;
  const ny = (dx / length) * bend;
  const spin = (index % 2 === 0 ? 1 : -1) * 540;
  const animation = element.animate(
    [
      { transform: 'translate(0, 0) scale(0.3) rotate(0deg)', opacity: 0 },
      {
        offset: 0.15,
        transform: `translate(${nx * 0.4}px, ${ny * 0.4 - 30}px) scale(1.3)`,
        opacity: 1,
      },
      {
        offset: 0.55,
        transform: `translate(${dx * 0.5 + nx}px, ${dy * 0.5 + ny}px) scale(1) rotate(${spin / 2}deg)`,
        opacity: 1,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(0.5) rotate(${spin}deg)`,
        opacity: 0.9,
      },
    ],
    {
      // The last lands as the chime rings (EVOLVE_LAND_SEC).
      duration: 560 + index * 12,
      delay: index * 18,
      easing: 'cubic-bezier(0.45, 0, 0.7, 1)',
      fill: 'forwards',
    }
  );
  animation.onfinish = () => element.remove();
  return animation;
}

/** A shockwave and a spray of sparks where the strands land. */
function burst(
  layer: HTMLElement,
  at: Point,
  color: Rgb,
  maxed: boolean
): void {
  const rings = maxed ? [color, WHITE, color] : [color, WHITE];
  rings.forEach((ringColor, index) => {
    const ring = dot(
      layer,
      at,
      24,
      `border: 3px solid ${rgba(ringColor, 0.9)}; box-shadow: 0 0 18px ${rgba(ringColor, 0.7)}`
    );
    ring.animate(
      [
        { transform: 'scale(0.2)', opacity: 1 },
        { transform: `scale(${maxed ? 9 : 6})`, opacity: 0 },
      ],
      {
        duration: 650,
        delay: index * 110,
        easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)',
        fill: 'forwards',
      }
    ).onfinish = () => ring.remove();
  });
  const sparks = maxed ? 22 : 12;
  for (let i = 0; i < sparks; i++) {
    const angle = (i / sparks) * Math.PI * 2;
    const reach = 40 + ((i * 53) % 50) * (maxed ? 1.6 : 1);
    const spark = dot(
      layer,
      at,
      5,
      `background: ${rgba(mix(color, WHITE, 0.5))}; box-shadow: 0 0 8px ${rgba(color)}`
    );
    spark.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        {
          transform: `translate(${Math.cos(angle) * reach}px, ${Math.sin(angle) * reach}px) scale(0.2)`,
          opacity: 0,
        },
      ],
      { duration: 520 + (i % 4) * 60, easing: 'ease-out', fill: 'forwards' }
    ).onfinish = () => spark.remove();
  }
}

/** The target lights up and swells for a moment. */
function glow(target: Element, color: Rgb): void {
  if (typeof (target as HTMLElement).animate !== 'function') {
    return;
  }
  (target as HTMLElement).animate(
    [
      { transform: 'scale(1)', filter: 'brightness(1)' },
      {
        transform: 'scale(1.7)',
        filter: `brightness(2.2) drop-shadow(0 0 10px ${rgba(color)})`,
        offset: 0.3,
      },
      { transform: 'scale(1)', filter: 'brightness(1)' },
    ],
    { duration: 600, easing: 'ease-out' }
  );
}

/** A flash of light over the screen and a short shake. */
function flashAndShake(stage: HTMLElement, maxed: boolean): void {
  const amount = maxed ? 7 : 4;
  stage.animate(
    [
      { transform: 'translate(0, 0)', filter: 'brightness(1)' },
      {
        transform: `translate(${-amount}px, ${amount / 2}px)`,
        filter: `brightness(${maxed ? 1.6 : 1.35})`,
        offset: 0.15,
      },
      { transform: `translate(${amount}px, ${-amount / 2}px)`, offset: 0.35 },
      { transform: `translate(${-amount / 2}px, 0)`, offset: 0.6 },
      { transform: `translate(${amount / 3}px, 0)`, offset: 0.8 },
      { transform: 'translate(0, 0)', filter: 'brightness(1)' },
    ],
    { duration: maxed ? 480 : 340, easing: 'ease-out' }
  );
}

function finished(animation: Animation): Promise<unknown> {
  return animation.finished.catch(() => undefined);
}
