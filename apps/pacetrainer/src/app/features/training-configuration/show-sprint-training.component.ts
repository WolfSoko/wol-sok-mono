import { Component, inject } from '@angular/core';
import { SprintTrainingDataService } from './data/sprint-training-data.service';

@Component({
  standalone: true,
  selector: 'pacetrainer-show-sprint-training',
  template: `
    <div class="mat-headline-small">Übersicht:</div>
    <div class="mat-body-medium">
      <div>{{ data().repetitions }} Wiederholungen</div>
      <div>{{ data().sprintTime }}s - Sprint</div>
      <div>{{ data().recoveryTime }}s - Gehen/Stehen</div>
    </div>
    <div class="mat-body-strong">Gesamtzeit: {{ data().totalTime }}s</div>
  `,
  styles: [``],
  imports: [],
})
export class ShowSprintTrainingComponent {
  data = inject(SprintTrainingDataService).data;
}
