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
import { rgba } from '../arena/canvas-math';
import { WeaponStats } from '../colony-stats';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { WEAPON_COLORS, weaponKeys } from '../menu/evolution-look';
import { weaponOf } from '../state/evolution';

/** The weapon button in CSS pixels; its recharge ring runs just outside it. */
export const WEAPON_BUTTON_SIZE = 64;
export const WEAPON_RING_SIZE = WEAPON_BUTTON_SIZE + 10;

/**
 * The button that fires the weapon a colony carries into the match (ADR
 * 0013), next to its boost pad: the weapon's icon, ringed by its recharge,
 * pulsing in the weapon's colour while it is ready.
 *
 * Like the boost it fires on the touch itself as well as on the click - a
 * second finger on the screen gets no click while the other one steers.
 */
@Component({
  selector: 'feat-lazy-bac-game-weapon-pad',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  template: `
    @let state = weapon();
    <span class="button-with-ring">
      <mat-progress-spinner
        class="charge"
        mode="determinate"
        [value]="state.charge * 100"
        [diameter]="ringSize"
        [strokeWidth]="4"
        [attr.aria-label]="'evolution.pad.recharge' | t"
      />
      <button
        mat-fab
        type="button"
        class="weapon-fab"
        [attr.aria-label]="'evolution.pad.button' | t: { weapon: name() }"
        [disabled]="disabled() || !state.ready"
        (pointerdown)="onPress($event)"
        (click)="fire.emit()"
      >
        <mat-icon>{{ icon() }}</mat-icon>
        <span class="weapon-state">{{ label() }}</span>
      </button>
    </span>
  `,
  styleUrl: './weapon-pad.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ready]': 'weapon().ready && !disabled()',
    '[class.active]': 'weapon().active',
    '[style.--weapon]': 'color()',
  },
})
export class WeaponPadComponent {
  /** The weapon of the colony this pad belongs to. */
  public readonly weapon = input.required<WeaponStats>();
  /** True while nobody is playing - the weapon cannot be fired then. */
  public readonly disabled = input(false);
  /** The player fires their weapon. */
  public readonly fire = output<void>();

  private readonly i18n = inject(I18nService);

  protected readonly ringSize = WEAPON_RING_SIZE;
  protected readonly icon = computed(() => weaponOf(this.weapon().id).icon);
  protected readonly color = computed(() =>
    rgba(WEAPON_COLORS[this.weapon().id])
  );
  protected readonly name = computed(() =>
    this.i18n.t(weaponKeys(this.weapon().id).name)
  );

  /** What the button says: fire, acting, or the seconds left to wait. */
  protected readonly label = computed(() => {
    const weapon = this.weapon();
    if (weapon.ready) {
      return this.i18n.t('evolution.pad.ready');
    }
    return weapon.active
      ? this.i18n.t('evolution.pad.active')
      : this.i18n.t('evolution.pad.cooldown', { seconds: weapon.cooldown });
  });

  /**
   * Fires on the touch itself, as the boost pad does. A press followed by
   * its click fires twice, which is harmless: a weapon that recharges
   * cannot be fired, so the game drops the second one.
   */
  protected onPress(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    this.fire.emit();
  }
}
