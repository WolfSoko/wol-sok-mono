import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { boostLabel, ColonyStats } from '../colony-stats';

/** The boost button in CSS pixels; the recharge ring runs just outside it. */
export const BOOST_BUTTON_SIZE = 88;
export const RECHARGE_RING_SIZE = BOOST_BUTTON_SIZE + 12;

/**
 * One player's boost pad in the touch layout: the boost button, ringed by
 * its recharge, and the colony's own numbers. Together with the joystick
 * zone it makes up the player's seat.
 *
 * On its own, in a column beside the arena, the numbers sit below the button.
 * In a band along the player's edge there is no room for that, so the pad
 * puts them beside the button instead. Where the pad sits on the screen and
 * which way it is turned is the stage's business.
 */
@Component({
  selector: 'feat-lazy-bac-game-boost-pad',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './boost-pad.component.html',
  styleUrl: './boost-pad.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.band]': 'band()',
    '[class.boosting]': 'colony().boosting',
    '[style.--seat-color]': 'colony().css',
  },
})
export class BoostPadComponent {
  /** The colony this pad belongs to. */
  public readonly colony = input.required<ColonyStats>();
  /** True while nobody is playing - the boost cannot be fired then. */
  public readonly disabled = input(false);
  /** True in a band along the player's edge: the numbers go beside the button. */
  public readonly band = input(false);

  /** The player fires their boost. */
  public readonly boost = output<void>();

  protected readonly boostLabel = boostLabel;
  protected readonly buttonSize = BOOST_BUTTON_SIZE;
  protected readonly ringSize = RECHARGE_RING_SIZE;
}
