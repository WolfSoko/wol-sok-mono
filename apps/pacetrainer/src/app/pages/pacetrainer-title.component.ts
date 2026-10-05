import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDivider } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'pace-title',
  styles: [
    `
      mat-toolbar {
        align-items: baseline;
      }
      .title {
        margin: 0 1em 0 0;
      }
      .subtitle {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      @media (max-width: 599px) {
        .subtitle {
          display: none;
        }
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
        <span class="subtitle mat-subtitle-2">Dein digitaler Laufcoach.</span>
      </mat-toolbar>
      <mat-divider></mat-divider>
    } @placeholder {
      <mat-spinner></mat-spinner>
    }
  `,
  imports: [MatToolbarModule, MatDivider, RouterLink, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PacetrainerTitleComponent {}
