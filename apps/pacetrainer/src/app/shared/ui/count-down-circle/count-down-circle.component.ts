import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { Milliseconds } from '../../model/constants/time-utils';
import { TrainingTimePipe } from '../training-time.pipe';

@Component({
  selector: 'pacetrainer-countdown-circle',
  templateUrl: './count-down-circle.component.html',
  styleUrl: './count-down-circle.component.scss',
  imports: [TrainingTimePipe, MatProgressSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountDownCircleComponent {
  timeLeft = input.required<Milliseconds>(); // milliseconds
  duration = input.required<Milliseconds>(); // milliseconds
}
