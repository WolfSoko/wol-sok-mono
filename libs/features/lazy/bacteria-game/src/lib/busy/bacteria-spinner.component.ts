import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** How many bacteria chase each other round the ring. */
const CELL_COUNT = 6;

/** One bacterium of the ring: where it sits and whose colony it is. */
interface SpinnerCell {
  /** Its place on the ring, counted clockwise from the top. */
  index: number;
  /** The opponent's colony; the others are the player's. */
  opponent: boolean;
}

const CELLS: readonly SpinnerCell[] = Array.from(
  { length: CELL_COUNT },
  (_, index) => ({ index, opponent: index % 2 === 1 })
);

/**
 * A busy indicator of the game's own: bacteria of both colonies on a
 * turning ring, each swelling as it closes in on the one ahead and
 * shrinking back as that one swells in turn, so they seem to eat each
 * other round the circle.
 *
 * It shows while heavy work blocks the main thread, so it animates only
 * `transform` and `opacity` of plain elements: those run on the
 * compositor and keep moving meanwhile, where anything drawn per frame
 * from script (a canvas, the simulation's shaders) would freeze.
 *
 * Its size is `--spinner-size` (4rem unless set); its colours are
 * `--bw-player` and `--bw-opponent`.
 */
@Component({
  selector: 'feat-lazy-bac-game-bacteria-spinner',
  template: `
    <div class="ring">
      @for (cell of cells; track cell.index) {
        <span class="seat" [style.--index]="cell.index">
          <span class="cell" [class.opponent]="cell.opponent"></span>
        </span>
      }
    </div>
  `,
  host: {
    role: 'progressbar',
    '[attr.aria-label]': 'label()',
  },
  styles: `
    :host {
      --cell-count: ${CELL_COUNT};
      --wave: 1.8s;

      position: relative;
      display: block;
      box-sizing: border-box;
      /* Every length below is a share of the size, in em. */
      font-size: var(--spinner-size, 4rem);
      width: 1em;
      height: 1em;
      border: 1px solid var(--bw-line-strong, #3a4659);
      border-radius: 50%;
      background: var(--bw-surface-raised, #19212c);
      box-shadow: 0 0.25rem 1.5rem rgb(0 0 0 / 50%);
    }

    .ring {
      position: absolute;
      inset: 0;
      animation: turn calc(var(--wave) * 2) linear infinite;
    }

    .seat {
      position: absolute;
      inset: 0;
      transform: rotate(calc(var(--index) * 1turn / var(--cell-count)));
    }

    .cell {
      --color: var(--bw-player, #4caf50);

      position: absolute;
      top: 0.12em;
      left: calc(50% - 0.1em);
      width: 0.2em;
      height: 0.2em;
      border-radius: 50%;
      /* The arena's look: a lighter nucleus in a body that darkens outwards. */
      background: radial-gradient(
        circle at 40% 40%,
        color-mix(in srgb, var(--color), white 55%) 0 18%,
        var(--color) 30%,
        color-mix(in srgb, var(--color), black 35%) 100%
      );
      animation: eat var(--wave) ease-in-out infinite;
      /* The wave runs clockwise: each one swells a step after the one behind. */
      animation-delay: calc(
        var(--index) * var(--wave) / var(--cell-count) - var(--wave)
      );
      will-change: transform;
    }

    .cell.opponent {
      --color: var(--bw-opponent, #4c8dff);
    }

    @keyframes turn {
      to {
        transform: rotate(1turn);
      }
    }

    /* Small, then swollen and leaning onto the next one, then small again. */
    @keyframes eat {
      0%,
      100% {
        transform: scale(0.6);
      }
      45% {
        transform: translateX(0.06em) scale(1.35);
      }
      60% {
        transform: translateX(0.03em) scale(1.1);
      }
    }

    /* Less motion: the bacteria stand still, the ring only breathes. */
    @media (prefers-reduced-motion: reduce) {
      .cell {
        animation: none;
      }

      .ring {
        animation: breathe 2s ease-in-out infinite alternate;
      }
    }

    @keyframes breathe {
      to {
        opacity: 0.5;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BacteriaSpinnerComponent {
  /** What the spinner says to screen readers. */
  public readonly label = input.required<string>();

  protected readonly cells = CELLS;
}
