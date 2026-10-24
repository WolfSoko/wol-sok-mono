import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { SeoService } from './seo.service';

@Component({
  imports: [RouterOutlet, RouterLink],
  selector: 'wolsok-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <a routerLink="/" class="logo" aria-label="wolsok.de home">
        wol<span>sok</span>
      </a>
      <a href="https://github.com/WolfSoko" class="github">GitHub</a>
    </header>
    <main>
      <router-outlet />
    </main>
    <footer>
      <span>© {{ year }} Wolfram Sokollek</span>
      <a routerLink="/privacy">Datenschutz / Privacy</a>
      <a href="https://github.com/WolfSoko/wol-sok-mono">Source</a>
    </footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      max-width: 72rem;
      margin: 0 auto;
      padding: 0 1rem;
    }
    header,
    footer {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      padding: 1.25rem 0;
    }
    header {
      justify-content: space-between;
    }
    .logo {
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--text);
      text-decoration: none;
    }
    .logo span {
      color: var(--accent-warm);
    }
    main {
      flex: 1;
    }
    footer {
      flex-wrap: wrap;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 0.9rem;
    }
    a {
      color: var(--muted);
    }
    a:hover {
      color: var(--text);
    }
  `,
})
export class AppComponent {
  protected readonly year = new Date().getFullYear();

  public constructor() {
    inject(SeoService).init();
  }
}
