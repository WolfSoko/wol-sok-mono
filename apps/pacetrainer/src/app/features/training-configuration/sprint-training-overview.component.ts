import { Component, inject, input } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatList, MatListItem } from '@angular/material/list';
import { TrainingTimePipe } from '../../shared/ui/training-time.pipe';
import { SprintTrainingDataService } from './data/sprint-training-data.service';

@Component({
  selector: 'pacetrainer-sprint-training-overview',
  template: `
    @let conf = data();
    @let repetitions = conf.repetitions;
    @let sprintTime = conf.sprintTime;
    @let recoveryTime = conf.recoveryTime;
    @let totalTime = conf.totalTime;

    <mat-expansion-panel [expanded]="open()" data-qa="training-overview">
      <mat-expansion-panel-header>
        <mat-panel-title>Übersicht</mat-panel-title>
        <mat-panel-description class="mat-body-medium">
          Training Konfiguration
        </mat-panel-description>
      </mat-expansion-panel-header>
      <mat-list>
        <mat-list-item>{{ repetitions }} Wiederholungen</mat-list-item>
        <mat-list-item>{{ sprintTime | trainingTime }} - Sprint</mat-list-item>
        <mat-list-item
          >{{ recoveryTime | trainingTime }} - Gehen/Stehen</mat-list-item
        >
        <mat-list-item class="mat-body-strong">
          Gesamtzeit: {{ totalTime | trainingTime }}
        </mat-list-item>
      </mat-list>
    </mat-expansion-panel>
  `,
  styles: [``],
  imports: [MatExpansionModule, MatList, MatListItem, TrainingTimePipe],
})
export class SprintTrainingOverviewComponent {
  open = input<boolean>(false);
  data = inject(SprintTrainingDataService).data;
}
