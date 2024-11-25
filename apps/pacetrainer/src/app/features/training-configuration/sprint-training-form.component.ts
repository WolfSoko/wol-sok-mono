import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { debounceTime } from 'rxjs';
import { SprintTrainingDataService } from './data/sprint-training-data.service';

@Component({
  standalone: true,
  selector: 'pacetrainer-sprint-form',
  template: `
    <form [formGroup]="sprintForm" class="sprint-form">
      <mat-form-field appearance="fill">
        <mat-label>Repetitions</mat-label>
        <input
          matInput
          id="repetitions"
          formControlName="repetitions"
          type="number"
        />
      </mat-form-field>

      <mat-form-field appearance="fill">
        <mat-label>Sprint Time</mat-label>
        <input
          matInput
          id="sprintTime"
          formControlName="sprintTime"
          type="number"
        />
      </mat-form-field>

      <mat-form-field appearance="fill">
        <mat-label>Recovery Time</mat-label>
        <input
          matInput
          id="recoveryTime"
          formControlName="recoveryTime"
          type="number"
        />
      </mat-form-field>
    </form>
  `,
  styles: [
    `
      .sprint-form {
        width: 200px;
      }
    `,
  ],
  imports: [MatCardModule, ReactiveFormsModule, MatInputModule],
})
export class SprintFormComponent {
  private readonly dataService = inject(SprintTrainingDataService);
  sprintForm = inject(NonNullableFormBuilder).group({
    sprintTime: [
      this.dataService.sprintTime(),
      [Validators.required, Validators.min(1)],
    ],
    repetitions: [
      this.dataService.repetitions(),
      [Validators.required, Validators.min(1)],
    ],
    recoveryTime: [
      this.dataService.recoveryTime(),
      [Validators.required, Validators.min(1)],
    ],
  });

  constructor() {
    this.sprintForm.valueChanges
      .pipe(debounceTime(500), takeUntilDestroyed())
      .subscribe((values) => this.dataService.updateState(values));
  }
}
