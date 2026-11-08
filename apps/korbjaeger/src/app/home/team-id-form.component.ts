import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  type AbstractControl,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { parseDbbId } from '@wolsok/feat-shared-basketball-data';

/** Opens the Team page of a DBB Team id typed in. */
@Component({
  selector: 'korb-team-id-form',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="openTeam()">
      <mat-form-field appearance="outline">
        <mat-label>Team-ID beim DBB</mat-label>
        <input matInput formControlName="teamId" inputmode="numeric" />
        @if (form.controls.teamId.hasError('required')) {
          <mat-error>Bitte eine Team-ID eingeben.</mat-error>
        } @else if (form.controls.teamId.hasError('teamId')) {
          <mat-error
            >Eine Team-ID besteht nur aus Ziffern, z. B. 313036.</mat-error
          >
        }
      </mat-form-field>
      <button mat-flat-button type="submit">Spiele zeigen</button>
    </form>
  `,
  styles: `
    form {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: baseline;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamIdFormComponent {
  private readonly router = inject(Router);

  protected readonly form = new FormGroup({
    teamId: new FormControl('', {
      nonNullable: true,
      validators: [teamIdValidator],
    }),
  });

  protected openTeam(): void {
    const teamId = parseDbbId(this.form.controls.teamId.value.trim());
    if (teamId === undefined) {
      this.form.markAllAsTouched();
      return;
    }
    void this.router.navigate(['/team', teamId]);
  }
}

/**
 * `required` for blank text (spaces too), `teamId` for text that names no
 * DBB id.
 */
function teamIdValidator(
  control: AbstractControl<string>
): ValidationErrors | null {
  const text = control.value.trim();
  if (text === '') {
    return { required: true };
  }
  return parseDbbId(text) === undefined ? { teamId: true } : null;
}
