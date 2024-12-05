import { Component, input } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { CurrentIntervalDataModel } from '../../shared/model/training/current-interval-data.model';
import { TrainingRunnerState } from '../../shared/training-runner/training-runner.state';
import { TrainingTimePipe } from '../../shared/ui/training-time.pipe';

@Component({
  selector: 'pacetrainer-training-live-state',
  styleUrl: 'training-live-state.component.scss',
  templateUrl: 'training-live-state.component.html',
  imports: [MatListModule, TrainingTimePipe],
})
export class TrainingLiveStateComponent {
  trainingState = input.required<TrainingRunnerState>();
  currentInterval = input.required<CurrentIntervalDataModel>();
}
