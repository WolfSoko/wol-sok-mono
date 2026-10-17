import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ColonyStats } from '../colony-stats';

/**
 * One player's place at the edge of the phone in the touch layout: the boost
 * button, ringed by its recharge, and the colony's own numbers.
 *
 * The player at the far edge looks at the phone from the other side, so a
 * flipped seat turns its content by 180 degrees. Where the seat sits on the
 * screen is the stage's business - it places the element on its grid.
 */
@Component({
  selector: 'feat-lazy-bac-game-seat',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './seat.component.html',
  styleUrl: './seat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.flipped]': 'flipped()',
    '[class.boosting]': 'colony().boosting',
    '[style.--seat-color]': 'colony().css',
  },
})
export class SeatComponent {
  /** The colony this seat belongs to. */
  public readonly colony = input.required<ColonyStats>();
  /** True while a match is on - only then may the boost be fired. */
  public readonly running = input(false);
  /** True for the player at the far edge. */
  public readonly flipped = input(false);

  /** The player fires their boost. */
  public readonly boost = output<void>();

  /** The recharge ring: filled as far as the boost has recharged. */
  protected chargeRing(): string {
    const colony = this.colony();
    return `conic-gradient(${colony.css} ${colony.boostCharge * 100}%, transparent 0)`;
  }
}
