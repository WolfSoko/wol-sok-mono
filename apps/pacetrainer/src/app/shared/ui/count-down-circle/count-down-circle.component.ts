import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { Milliseconds } from '../../model/constants/time-utils';
import { TrainingTimePipe } from '../training-time.pipe';

const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A ring that empties as the time runs out; color comes from --pace-accent. */
@Component({
  selector: 'pace-countdown-circle',
  templateUrl: './count-down-circle.component.html',
  styleUrl: './count-down-circle.component.scss',
  imports: [TrainingTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountDownCircleComponent {
  public readonly timeLeft = input.required<Milliseconds>();
  public readonly duration = input.required<Milliseconds>();

  protected readonly radius = RADIUS;
  protected readonly circumference = CIRCUMFERENCE;
  protected readonly dashOffset = computed(() => {
    const duration = this.duration();
    const share = duration > 0 ? this.timeLeft() / duration : 0;
    return CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, share)));
  });
}
