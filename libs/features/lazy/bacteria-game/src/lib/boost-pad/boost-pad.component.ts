import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { boostLabel, ColonyStats } from '../colony-stats';

/**
 * One player's boost pad in the touch layout: the boost button, ringed by
 * its recharge, and the colony's own numbers. Together with the joystick
 * zone on the other side of the arena it makes up the player's seat.
 *
 * The player at the far edge looks at the phone from the other side, so a
 * flipped pad turns its content by 180 degrees. Where the pad sits on the
 * screen is the stage's business - it places the element on its grid.
 */
@Component({
  selector: 'feat-lazy-bac-game-boost-pad',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './boost-pad.component.html',
  styleUrl: './boost-pad.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.flipped]': 'flipped()',
    '[class.boosting]': 'colony().boosting',
    '[style.--seat-color]': 'colony().css',
  },
})
export class BoostPadComponent {
  /** The colony this pad belongs to. */
  public readonly colony = input.required<ColonyStats>();
  /** True while a match is on - only then may the boost be fired. */
  public readonly running = input(false);
  /** True for the player at the far edge. */
  public readonly flipped = input(false);

  /** The player fires their boost. */
  public readonly boost = output<void>();

  protected readonly boostLabel = boostLabel;

  /** The recharge ring: filled as far as the boost has recharged. */
  protected chargeRing(): string {
    const colony = this.colony();
    return `conic-gradient(${colony.css} ${colony.boostCharge * 100}%, transparent 0)`;
  }
}
