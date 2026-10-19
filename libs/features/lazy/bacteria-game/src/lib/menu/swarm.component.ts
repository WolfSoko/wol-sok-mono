import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { Rgb } from '../arena/arena-theme';
import { mix, rgba } from '../arena/canvas-math';
import { seeded } from '../state/geometry';

/** One drifting bacterium of the swarm, in the units its styles take. */
interface SwarmCell {
  /** Position in per cent of the swarm's box. */
  left: number;
  top: number;
  /** Diameter in pixels. */
  size: number;
  background: string;
  opacity: number;
  /** How far it drifts and back, in pixels. */
  dx: number;
  dy: number;
  /** One drift there and back, in seconds, and how far into it it starts. */
  durationSec: number;
  delaySec: number;
}

/**
 * Two colonies drifting towards each other - the living background of the
 * menu screens. Plain CSS animation, so it costs the game loop nothing, and
 * still for players who ask for less motion; small screens draw half of
 * it. Seeded, so every visit shows the same swarm.
 */
@Component({
  selector: 'feat-lazy-bac-game-swarm',
  template: `
    @for (cell of cells(); track $index) {
      <span
        class="cell"
        [style.left.%]="cell.left"
        [style.top.%]="cell.top"
        [style.width.px]="cell.size"
        [style.height.px]="cell.size"
        [style.background]="cell.background"
        [style.opacity]="cell.opacity"
        [style.--dx.px]="cell.dx"
        [style.--dy.px]="cell.dy"
        [style.animation-duration.s]="cell.durationSec"
        [style.animation-delay.s]="-cell.delaySec"
      ></span>
    }
  `,
  styleUrl: './swarm.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class SwarmComponent {
  /** The colours of the left and the right colony, as RGB. */
  public readonly colors = input.required<readonly [Rgb, Rgb]>();
  /** How many bacteria drift. */
  public readonly count = input(60);

  protected readonly cells = computed(() =>
    swarm(this.count(), this.colors(), 11)
  );
}

/**
 * The swarm: even cells to the left colony, odd ones to the right, each
 * gathered on its own side and reaching for the middle. Some are far away
 * and fainter.
 */
export function swarm(
  count: number,
  colors: readonly [Rgb, Rgb],
  seed: number
): SwarmCell[] {
  const random = seeded(seed);
  return Array.from({ length: count }, (_, index) => {
    const left = index % 2 === 0;
    const far = random() < 0.45;
    return {
      left: left ? random() * 55 : 45 + random() * 55,
      top: random() * 100,
      size: Math.round(8 + random() * 24),
      background: glossy(colors[left ? 0 : 1]),
      opacity: far ? 0.18 : 0.42,
      dx: Math.round((left ? 1 : -1) * (40 + random() * 110)),
      dy: Math.round((random() - 0.5) * 90),
      durationSec: round1(8 + random() * 10),
      delaySec: round1(random() * 12),
    };
  });
}

/** A lit sphere in a colour: a pale highlight, the colour, a darker rim. */
function glossy(color: Rgb): string {
  const highlight = rgba(mix(color, [255, 255, 255], 0.6));
  const rim = rgba(mix(color, [0, 0, 0], 0.35));
  return `radial-gradient(circle at 35% 30%, ${highlight}, ${rgba(color)} 45%, ${rim})`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
