import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'pace-title',
  styles: `
    :host {
      display: block;
      padding-top: env(safe-area-inset-top);
      --mat-toolbar-container-background-color: transparent;
    }
    .bar {
      gap: 12px;
      max-width: 560px;
      margin: 0 auto;
      padding: 0 16px;
    }
    .logo {
      display: block;
      width: 36px;
      height: 36px;
      border-radius: 10px;
    }
    .title {
      font: var(--mat-sys-title-large);
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .subtitle {
      margin-left: auto;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap;
    }
    @media (max-width: 599px) {
      .subtitle {
        display: none;
      }
    }
  `,
  template: `
    <mat-toolbar class="bar">
      <a routerLink="/" aria-label="Startseite">
        <img
          class="logo"
          src="/android-chrome-192x192.png"
          alt=""
          width="36"
          height="36"
        />
      </a>
      <h1 class="title">Pace-Trainer</h1>
      <span class="subtitle">Dein digitaler Laufcoach.</span>
    </mat-toolbar>
  `,
  imports: [MatToolbarModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PacetrainerTitleComponent {}
