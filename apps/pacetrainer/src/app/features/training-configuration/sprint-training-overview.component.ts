import { Component, inject, input } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatList, MatListItem } from '@angular/material/list';
import { SprintTrainingDataService } from './data/sprint-training-data.service';

@Component({
  standalone: true,
  selector: 'pacetrainer-sprint-training-overview',
  template: `
    <mat-expansion-panel [expanded]="open()">
      <mat-expansion-panel-header>
        <mat-panel-title>Übersicht</mat-panel-title>
        <mat-panel-description class="mat-body-medium">
          Training Konfiguration
        </mat-panel-description>
      </mat-expansion-panel-header>
      <mat-list>
        <mat-list-item>{{ data().repetitions }} Wiederholungen</mat-list-item>
        <mat-list-item>{{ data().sprintTime }}s - Sprint</mat-list-item>
        <mat-list-item>{{ data().recoveryTime }}s - Gehen/Stehen</mat-list-item>
        <mat-list-item class="mat-body-strong">
          Gesamtzeit: {{ data().totalTime }}s
        </mat-list-item>
      </mat-list>
    </mat-expansion-panel>
  `,
  styles: [``],
  imports: [MatExpansionModule, MatList, MatListItem],
})
export class SprintTrainingOverviewComponent {
  open = input<boolean>(false);
  data = inject(SprintTrainingDataService).data;
}
