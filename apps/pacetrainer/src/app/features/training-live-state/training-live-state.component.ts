import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Milliseconds } from '../../shared/model/constants/time-utils';
import { CountdownModel } from '../../shared/model/training/countdown.model';
import { IntervalView, RunPhase } from '../../shared/training-run/training-run';
import { TrainingNamePipe } from '../../shared/ui/training-name.pipe';
import { TrainingTimePipe } from '../../shared/ui/training-time.pipe';

/** Frames the timer of a running Trainingslauf: what runs now, what comes next. */
@Component({
  selector: 'pace-training-live-state',
  styleUrl: 'training-live-state.component.scss',
  templateUrl: 'training-live-state.component.html',
  imports: [TrainingTimePipe, TrainingNamePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingLiveStateComponent {
  public readonly countdown = input<CountdownModel | null>();
  public readonly phase = input.required<RunPhase>();
  public readonly current = input<IntervalView>();
  public readonly elapsed = input<Milliseconds>();
}
