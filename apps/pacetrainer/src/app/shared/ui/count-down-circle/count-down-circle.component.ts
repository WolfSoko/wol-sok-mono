import { Component, computed, inject, Injector, input } from '@angular/core';
import { Milliseconds } from '../../model/constants/time-utils';
import { TrainingTimePipe } from '../training-time.pipe';

const FULL_DASHARRAY = 283;

@Component({
  selector: 'pacetrainer-countdown-circle',
  templateUrl: './count-down-circle.component.html',
  standalone: true,
  styleUrl: './count-down-circle.component.scss',
  imports: [TrainingTimePipe],
})
export class CountDownCircleComponent {
  private readonly injector = inject(Injector);

  timeLeft = input.required<Milliseconds>(); // milliseconds
  duration = input.required<Milliseconds>(); // milliseconds

  dasharray = computed(() => {
    const timeLeft: number = this.timeLeft?.() ?? this.duration();
    const rawFraction = timeLeft / this.duration();
    const fraction = rawFraction - (1 / this.duration()) * (1 - rawFraction);
    const remaining = Math.round(fraction * FULL_DASHARRAY);
    return `${remaining} ${FULL_DASHARRAY}`;
  });
}
