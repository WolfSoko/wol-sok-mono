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
 * zone on the other side of the arena it makes up the player's seat.
 *
 * The player at the far edge looks at the phone from the other side, so a
 * flipped pad turns its content by 180 degrees. Where the pad sits on the
 * screen is the stage's business - it places the element on its grid.
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
    '[class.flipped]': 'flipped()',
    '[class.boosting]': 'colony().boosting',
    '[style.--seat-color]': 'colony().css',
  },
})
export class BoostPadComponent {
  /** The colony this pad belongs to. */
  public readonly colony = input.required<ColonyStats>();
  /** True while nobody is playing - the boost cannot be fired then. */
  public readonly disabled = input(false);
  /** True for the player at the far edge. */
  public readonly flipped = input(false);

  /** The player fires their boost. */
  public readonly boost = output<void>();

  protected readonly boostLabel = boostLabel;
  protected readonly buttonSize = BOOST_BUTTON_SIZE;
  protected readonly ringSize = RECHARGE_RING_SIZE;
}
