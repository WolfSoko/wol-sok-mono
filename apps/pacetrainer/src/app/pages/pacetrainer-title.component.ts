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
      height: 72px;
      margin: 0 auto;
      padding: 0 16px;
    }
    .home {
      display: flex;
      border-radius: 12px;
      outline-offset: 3px;
    }
    .logo {
      display: block;
      width: 40px;
      height: 40px;
      border-radius: 11px;
      box-shadow: 0 6px 16px -6px rgb(10 21 48 / 0.6);
    }
    .title {
      font: var(--mat-sys-title-large);
      font-weight: 700;
      letter-spacing: -0.02em;
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
      <a routerLink="/" class="home" aria-label="Startseite">
        <img class="logo" src="/logo.svg" alt="" width="40" height="40" />
      </a>
      <h1 class="title">Pace-Trainer</h1>
      <span class="subtitle">Dein digitaler Laufcoach.</span>
    </mat-toolbar>
  `,
  imports: [MatToolbarModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PacetrainerTitleComponent {}
