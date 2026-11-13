import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';

/**
 * The countdown before a match, laid over the middle of the arena: one big
 * number a second, announced to a screen reader as it changes. It only
 * shows the number it is given; the stage hides it outside the countdown.
 */
@Component({
  selector: 'feat-lazy-bac-game-match-countdown',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="cdk-visually-hidden" role="status" aria-live="assertive">
      {{ 'stage.countdown' | t: { seconds: count() } }}
    </p>
    <!-- Keyed by the number, so each one plays its entrance afresh. -->
    @for (shown of [count()]; track shown) {
      <span class="number" aria-hidden="true">{{ shown }}</span>
    }
  `,
  styleUrl: './match-countdown.component.scss',
})
export class MatchCountdownComponent {
  /** The seconds left before the match starts: 3, 2, 1. */
  public readonly count = input.required<number>();
}
