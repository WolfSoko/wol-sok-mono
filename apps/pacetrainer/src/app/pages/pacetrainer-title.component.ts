import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'pace-title',
  styles: `
    :host {
      display: block;
      padding: max(env(safe-area-inset-top), 12px) 16px 4px;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 560px;
      margin: 0 auto;
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
    <header class="bar">
      <a routerLink="/" aria-label="Startseite">
        <img
          class="logo"
          src="/android-chrome-192x192.png"
          alt=""
          width="36"
          height="36"
        />
      </a>
      <span role="heading" aria-level="1" class="title">Pace-Trainer</span>
      <span class="subtitle">Dein digitaler Laufcoach.</span>
    </header>
  `,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PacetrainerTitleComponent {}
