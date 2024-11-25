import { Component, inject } from '@angular/core';
import { SprintTrainingDataService } from './data/sprint-training-data.service';

@Component({
  standalone: true,
  selector: 'pacetrainer-show-sprint-training',
  template: `
    <div>{{ data().sprintTime }}s - Sprint</div>
    <div>{{ data().recoveryTime }}s - Gehen/Stehen</div>
    <div>{{ data().repetitions }} Wiederholungen</div>
    <div>Gesamtzeit: {{ data().totalTime }}s</div>
  `,
  styles: [``],
  imports: [],
})
export class ShowSprintTrainingComponent {
  data = inject(SprintTrainingDataService).data;
}
