import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';

@Component({
  selector: 'korb-home',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h1>Korbjäger</h1>
    <p>Die Spiele eines Basketball-Teams der laufenden Saison.</p>
    <form (ngSubmit)="openTeam(teamId.value)">
      <mat-form-field appearance="outline">
        <mat-label>Team-ID beim DBB</mat-label>
        <input #teamId matInput inputmode="numeric" pattern="[0-9]+" required />
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
export default class HomePage {
  private readonly router = inject(Router);

  protected openTeam(teamId: string): void {
    const id = teamId.trim();
    if (id) {
      void this.router.navigate(['/team', id]);
    }
  }
}
