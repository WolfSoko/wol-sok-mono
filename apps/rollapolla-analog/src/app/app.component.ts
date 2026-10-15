import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer, Title } from '@angular/platform-browser';
import { RouterLink, RouterOutlet } from '@angular/router';
import { faXTwitter } from '@fortawesome/free-brands-svg-icons';
import { icon } from '@fortawesome/fontawesome-svg-core';
import { AccountComponent } from './core/account/account.component';

@Component({
  selector: 'rap-root',
  imports: [
    AccountComponent,
    MatButtonModule,
    MatIconModule,
    RouterLink,
    RouterOutlet,
  ],
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
            width="36"
            height="36"
          />
          <span class="brand-name">RollaPolla</span>
        </a>
        <div class="header-actions">
          <a
            mat-button
            class="browse-link"
            routerLink="/polls"
            aria-label="Browse polls"
            title="Browse polls"
            data-testid="header-browse-link"
          >
            <mat-icon>search</mat-icon>
            <span class="browse-label">Browse</span>
          </a>
          <rap-account />
          <a
            mat-stroked-button
            class="follow-link"
            target="_blank"
            rel="noopener"
            href="https://x.com/rollapolla"
            aria-label="Follow RollaPolla on X"
          >
            <mat-icon svgIcon="fa:xTwitter" />
            Follow
          </a>
        </div>
      </div>
    </header>
    <div class="page">
      <router-outlet />
    </div>
    <footer class="site-footer">
      <div class="rap-container footer-inner">
        <span>© RollaPolla · Polls for everyone</span>
        <nav class="footer-links" aria-label="More">
          <a routerLink="/polls">Browse polls</a>
          <a href="https://x.com/rollapolla" target="_blank" rel="noopener"
            >Follow us on X</a
          >
          <span>Built with Angular &amp; Analog</span>
        </nav>
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
      width: 36px;
      height: 36px;
    }
    .brand-name {
      font: var(--mat-sys-title-large);
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    /* phones: brand, browse link and account bar share one row; following
       on X moves to the footer */
    @media (max-width: 599.98px) {
      .browse-link {
        min-width: 0;
        --mat-button-text-horizontal-padding: 0.5rem;
        --mat-button-text-with-icon-horizontal-padding: 0.5rem;
      }
      .browse-link .mat-icon {
        margin: 0;
      }
      .browse-label,
      .follow-link {
        display: none;
      }
    }
    .footer-links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1.25rem;
    }
    .footer-links a {
      color: inherit;
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
