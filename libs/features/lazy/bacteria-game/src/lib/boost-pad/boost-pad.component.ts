import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ColonyStats } from '../colony-stats';
import { playerNameText, renderGameText } from '../i18n/game-texts';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';

/** The boost button in CSS pixels; the recharge ring runs just outside it. */
const BOOST_BUTTON_SIZE = 88;
const RECHARGE_RING_SIZE = BOOST_BUTTON_SIZE + 12;

/**
 * One player's boost pad in the touch layout: the boost button, ringed by
 * its recharge. Together with the joystick zone it makes up the player's
 * seat. It stays in one place over the arena - which corner and which way
 * it is turned is the stage's business; the colony's numbers are in the
 * HUD.
 */
@Component({
  selector: 'feat-lazy-bac-game-boost-pad',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './boost-pad.component.html',
  styleUrl: './boost-pad.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.boosting]': 'colony().boosting',
    '[style.--seat-color]': 'colony().css',
  },
})
export class BoostPadComponent {
  /** The colony this pad belongs to. */
  public readonly colony = input.required<ColonyStats>();
  /** True while nobody is playing - the boost cannot be fired then. */
  public readonly disabled = input(false);
  /** The player fires their boost. */
  public readonly boost = output<void>();

  private readonly i18n = inject(I18nService);

  /** The colony's name in the active language - an online name as it is. */
  protected readonly name = computed(() => {
    const name = this.colony().name;
    const text = playerNameText(name);
    return text === null
      ? name
      : renderGameText(text, (key, params) => this.i18n.t(key, params));
  });

  /** What the button says: ready, running, or the seconds left to wait. */
  protected readonly boostLabel = computed(() => {
    const colony = this.colony();
    if (colony.boostReady) {
      return this.i18n.t('controls.boost.ready');
    }
    return colony.boosting
      ? this.i18n.t('controls.boost.boosting')
      : this.i18n.t('controls.boost.cooldown', {
          seconds: colony.boostCooldown,
        });
  });
  protected readonly ringSize = RECHARGE_RING_SIZE;

  /**
   * Fires on the touch itself as well as on the click. While the other hand
   * holds the joystick the tap is the second finger on the screen, and
   * browsers send no click for a tap during a multi-touch - the boost would
   * never fire. The click still covers the keyboard and assistive tech.
   *
   * A press followed by its click fires twice, which is harmless: a boost
   * that is running cannot be fired again, so the game drops the second one.
   */
  protected onPress(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    // Keeps the browser from turning the touch into a focus move.
    event.preventDefault();
    this.boost.emit();
  }
}
