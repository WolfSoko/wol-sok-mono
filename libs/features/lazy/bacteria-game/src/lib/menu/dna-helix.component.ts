import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The rungs of the helix, top to bottom. */
const RUNGS = [0, 1, 2, 3, 4, 5, 6];

/**
 * A strand of DNA, turning - the icon of the DNA counter. Its rungs swing
 * one after the other, which reads as a double helix spinning; still for
 * players who ask for less motion, and where `animated` is off - the small
 * ones on the buy buttons, many at once. Decoration only.
 */
@Component({
  selector: 'feat-lazy-bac-game-dna-helix',
  template: `
    <svg
      viewBox="0 0 24 32"
      [attr.width]="size() * 0.75"
      [attr.height]="size()"
    >
      @for (rung of rungs; track rung) {
        <g
          class="rung"
          [attr.transform]="'translate(12 ' + (3 + rung * 4.3) + ')'"
        >
          <g class="twist" [style.animation-delay.s]="-rung * 0.22">
            <line x1="-8" x2="8" y1="0" y2="0" />
            <circle class="a" cx="-8" cy="0" r="2.2" />
            <circle class="b" cx="8" cy="0" r="2.2" />
          </g>
        </g>
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }

    line {
      stroke: currentcolor;
      stroke-width: 1.4;
      stroke-linecap: round;
      opacity: 0.55;
    }

    .a {
      fill: var(--helix-a, #7cf2c8);
    }

    .b {
      fill: var(--helix-b, #e9b949);
    }

    .twist {
      animation: twist 1.5s ease-in-out infinite;
    }

    @keyframes twist {
      0%,
      100% {
        transform: scaleX(1);
      }

      50% {
        transform: scaleX(-1);
      }
    }

    /* Held mid-turn: still a helix, not a ladder. */
    :host(.still) .twist {
      animation-play-state: paused;
    }

    @media (prefers-reduced-motion: reduce) {
      .twist {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class.still]': '!animated()' },
})
export class DnaHelixComponent {
  /** Its height in CSS pixels. */
  public readonly size = input(28);
  /** False keeps it still. */
  public readonly animated = input(true);

  protected readonly rungs = RUNGS;
}
