import { Component } from '@angular/core';
import { MatDivider } from '@angular/material/divider';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'pacetrainer-title',
  standalone: true,
  styles: [
    `
      mat-toolbar {
        align-items: baseline;
      }
      .title {
        margin: 0 1em 0 0;
      }
    `,
  ],
  template: `
    <mat-toolbar color="primary">
      <span role="heading" class="title mat-title-large">Pace-Trainer</span>
      <span class="mat-subtitle-2">Dein digitaler Laufcoach.</span>
    </mat-toolbar>
    <mat-divider />
  `,
  imports: [MatToolbarModule, MatDivider],
})
export class PacetrainerTitleComponent {
  count = 0;
  increment() {
    this.count++;
  }
}