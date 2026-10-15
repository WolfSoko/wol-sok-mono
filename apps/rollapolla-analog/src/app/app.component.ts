import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer, Title } from '@angular/platform-browser';
import { RouterLink, RouterOutlet } from '@angular/router';
import { faXTwitter } from '@fortawesome/free-brands-svg-icons';
import { icon } from '@fortawesome/fontawesome-svg-core';

@Component({
  selector: 'rap-root',
  imports: [MatButtonModule, MatIconModule, RouterLink, RouterOutlet],
  template: `
    <header class="site-header">
      <div class="rap-container header-inner">
        <a
          class="brand"
          routerLink="/"
          data-testid="home-link"
          aria-label="RollaPolla home"
        >
          <img
            class="brand-logo"
            src="/assets/logos/logo.svg"
            alt=""
            width="44"
            height="32"
          />
          <span class="brand-name">RollaPolla</span>
        </a>
        <a
          mat-stroked-button
          class="follow-link"
          target="_blank"
          rel="noopener"
          href="https://x.com/rollapolla"
        >
          <mat-icon svgIcon="fa:xTwitter" />
          Follow
        </a>
      </div>
    </header>
    <div class="page">
      <router-outlet />
    </div>
    <footer class="site-footer">
      <div class="rap-container footer-inner">
        <span>© RollaPolla · Polls for everyone</span>
        <span>Built with Angular &amp; Analog</span>
      </div>
    </footer>
  `,
  styles: `
    .site-header {
      position: sticky;
      top: 0;
      z-index: 10;
      backdrop-filter: blur(16px);
      background: color-mix(in srgb, var(--mat-sys-surface) 72%, transparent);
      border-bottom: 1px solid
        color-mix(in srgb, var(--mat-sys-outline-variant) 60%, transparent);
    }
    .header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      height: 4rem;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      color: inherit;
      text-decoration: none;
      border-radius: 999px;
    }
    .brand:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 4px;
    }
    .brand-logo {
      display: block;
      width: 44px;
      height: auto;
    }
    .brand-name {
      font: var(--mat-sys-title-large);
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .page {
      flex: 1 0 auto;
    }
    .site-footer {
      margin-top: 4rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .footer-inner {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0.5rem;
      padding-block: 1.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  constructor() {
    const svg = icon(faXTwitter).html.join('');
    inject(MatIconRegistry).addSvgIconLiteralInNamespace(
      'fa',
      'xTwitter',
      inject(DomSanitizer).bypassSecurityTrustHtml(svg)
    );
    inject(Title).setTitle('Polls for everyone | RollaPolla.com');
  }
}
