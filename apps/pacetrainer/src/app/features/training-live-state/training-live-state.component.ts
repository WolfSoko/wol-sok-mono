import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { CountdownModel } from '../../shared/model/training/countdown.model';
import { CurrentExerciseViewModel } from '../../shared/model/training/current-exercise-view.model';
import { TrainingRunnerState } from '../../shared/training-runner/training-runner.state';
import { TrainingNamePipe } from '../../shared/ui/training-name.pipe';
import { TrainingTimePipe } from '../../shared/ui/training-time.pipe';

@Component({
  selector: 'pacetrainer-training-live-state',
  styleUrl: 'training-live-state.component.scss',
  templateUrl: 'training-live-state.component.html',
  imports: [MatListModule, TrainingTimePipe, TrainingNamePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingLiveStateComponent {
  countdown = input<CountdownModel | null>();
  trainingState = input.required<TrainingRunnerState>();
  currentExercise = input<CurrentExerciseViewModel>();
}
