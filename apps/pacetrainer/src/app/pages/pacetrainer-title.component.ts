import { Component } from '@angular/core';
import { MatDivider } from '@angular/material/divider';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'pacetrainer-title',
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
    @defer (hydrate on interaction) {
      <mat-toolbar color="primary">
        <span role="heading" class="title mat-title-large">
          <a routerLink="/"
            ><img src="/android-chrome-192x192.png" height="32px" width="32px"
          /></a>
          Pace-Trainer
        </span>
        <span class="mat-subtitle-2">Dein digitaler Laufcoach.</span>
      </mat-toolbar>
      <mat-divider />
    }
  `,
  imports: [MatToolbarModule, MatDivider, RouterLink],
})
export class PacetrainerTitleComponent {}
