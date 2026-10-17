import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import {
  injectSetNotFoundStatus,
  SITE_TAGS,
  SITE_URL,
  usePageTags,
} from './site-tags';

/** Every path no other page matches: a real 404, not a copy of the home page. */
@Component({
  selector: 'rap-not-found-page',
  imports: [MatButtonModule, MatCardModule, MatIconModule, RouterLink],
  template: `
    <main class="rap-container main">
      <mat-card
        appearance="outlined"
        class="not-found"
        data-testid="page-not-found"
      >
        <mat-icon class="not-found-icon" aria-hidden="true"
          >search_off</mat-icon
        >
        <mat-card-header>
          <mat-card-title><h1>Page not found</h1></mat-card-title>
          <mat-card-subtitle>
            This page does not exist (anymore).
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
          <a mat-flat-button routerLink="/">Create a poll</a>
          <a mat-button routerLink="/polls">Browse polls</a>
        </mat-card-actions>
      </mat-card>
    </main>
  `,
  styles: `
    .main {
      max-width: 760px;
      padding-block: clamp(1.5rem, 5vw, 3rem) 0;
    }
    .not-found {
      align-items: center;
      gap: 0.5rem;
      padding: 2.5rem 1rem 1.5rem;
      text-align: center;
    }
    .not-found-icon {
      width: 3rem;
      height: 3rem;
      font-size: 3rem;
      color: var(--mat-sys-on-surface-variant);
    }
    h1 {
      margin: 0;
      font: inherit;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class NotFoundPageComponent {
  constructor() {
    usePageTags({
      ...SITE_TAGS,
      title: 'Page not found | RollaPolla',
      // its own URL: pointing at home would claim the 404 is a copy of it
      url: SITE_URL + inject(Router).url.split(/[?#]/)[0],
      robots: 'noindex',
    });
    injectSetNotFoundStatus()();
  }
}
