import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, map } from 'rxjs';
import { msToS, sToMs } from '../../shared/model/constants/time-utils';
import { SprintTrainingDataService } from './data/sprint-training-data.service';

@Component({
  selector: 'pace-sprint-form',
  template: `
    <form [formGroup]="sprintForm" class="sprint-form" data-qa="sprint-form">
      <mat-form-field appearance="outline" class="full">
        <mat-label>Wiederholungen</mat-label>
        <input
          matInput
          data-qa="repetitions"
          formControlName="repetitions"
          type="number"
          inputmode="numeric"
          placeholder="Wiederholungen"
        />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Sprintzeit</mat-label>
        <input
          matInput
          data-qa="sprintTime"
          formControlName="sprintTime"
          type="number"
          inputmode="numeric"
          placeholder="Sprintzeit (s)"
        />
        <span matTextSuffix>s</span>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Erholungszeit</mat-label>
        <input
          matInput
          data-qa="recoveryTime"
          formControlName="recoveryTime"
          type="number"
          inputmode="numeric"
          placeholder="Erholungszeit (s)"
        />
        <span matTextSuffix>s</span>
      </mat-form-field>
    </form>
  `,
  styles: [
    `
      .sprint-form {
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 12px;
        width: 100%;
      }
      .full {
        grid-column: 1 / -1;
      }
      mat-form-field {
        width: 100%;
      }
    `,
  ],
  imports: [ReactiveFormsModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprintFormComponent {
  private readonly dataService = inject(SprintTrainingDataService);
  sprintForm = inject(NonNullableFormBuilder).group({
    repetitions: [
      this.dataService.repetitions(),
      [Validators.required, Validators.min(1)],
    ],
    sprintTime: [
      msToS(this.dataService.sprintTime()),
      [Validators.required, Validators.min(1)],
    ],
    recoveryTime: [
      msToS(this.dataService.recoveryTime()),
      [Validators.required, Validators.min(1)],
    ],
  });

  constructor() {
    this.sprintForm.valueChanges
      .pipe(
        debounceTime(500),
        takeUntilDestroyed(),
        map(({ repetitions, sprintTime, recoveryTime }) => ({
          ...(repetitions ? { repetitions } : {}),
          ...(sprintTime ? { sprintTime: sToMs(sprintTime) } : {}),
          ...(recoveryTime ? { recoveryTime: sToMs(recoveryTime) } : {}),
        }))
      )
      .subscribe((values) => this.dataService.updateState(values));
  }
}
