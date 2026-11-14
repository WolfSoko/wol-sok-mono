import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { AppHistory } from './app-history';
import { Breadcrumb } from './breadcrumb';

/**
 * The app's navigation above every page: back and forward (an installed
 * app shows no browser buttons), the breadcrumb from the overview to the
 * page, and the actions (the search and the settings).
 */
@Component({
  selector: 'korb-title-bar',
  imports: [MatButtonModule, MatIconModule, MatToolbarModule, RouterLink],
  template: `
    <mat-toolbar>
      <button
        matIconButton
        type="button"
        aria-label="Zurück"
        [disabled]="!canGoBack()"
        (click)="back()"
      >
        <mat-icon>arrow_back</mat-icon>
      </button>
      <button
        matIconButton
        type="button"
        aria-label="Vor"
        [disabled]="!history.canGoForward()"
        (click)="history.forward()"
      >
        <mat-icon>arrow_forward</mat-icon>
      </button>
      <nav class="breadcrumb" aria-label="Seitenpfad">
        <ol>
          @for (level of breadcrumb.levels(); track $index) {
            <li>
              @if ($last) {
                <span class="level" aria-current="page">{{ level.title }}</span>
              } @else {
                <a class="level" [routerLink]="level.link">{{ level.title }}</a>
              }
            </li>
          }
        </ol>
      </nav>
      <div class="actions">
        <a
          matIconButton
          routerLink="/suchen"
          aria-label="Suchen"
          data-qa="search"
        >
          <mat-icon>search</mat-icon>
        </a>
        @if (signInBuilt) {
          <a
            matIconButton
            routerLink="/einstellungen"
            aria-label="Einstellungen"
            data-qa="settings"
          >
            <mat-icon>settings</mat-icon>
          </a>
        }
      </div>
    </mat-toolbar>
  `,
  styles: `
    mat-toolbar {
      gap: 0.25rem;
      padding-inline: 0.25rem;
    }
    .breadcrumb {
      flex: 1 1 auto;
      min-width: 0;
    }
    ol {
      display: flex;
      align-items: baseline;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      min-width: 0;
      // the levels above the page give way first
      flex: 0 1 auto;
    }
    li:last-child {
      flex-shrink: 0.25;
    }
    li + li::before {
      // shown only: the list already says where one level ends
      content: '›' / '';
      padding-inline: 0.375rem;
      flex: none;
    }
    .level {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      color: inherit;
      text-decoration: none;
    }
    a.level:hover,
    a.level:focus-visible {
      text-decoration: underline;
    }
    li + li {
      // the root keeps the toolbar's brand face
      font: var(--mat-sys-title-medium);
    }
    .actions {
      display: flex;
      flex: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TitleBarComponent {
  private readonly router = inject(Router);
  protected readonly history = inject(AppHistory);
  protected readonly breadcrumb = inject(Breadcrumb);

  /** Whether this build offers the sign-in, and with it the settings. */
  protected readonly signInBuilt = environment.signIn;

  /** Back, or up where nothing lies behind; the overview opened first has neither. */
  protected readonly canGoBack = computed(
    () => this.history.canGoBack() || this.breadcrumb.parentLink() !== undefined
  );

  /** Back, or up to the breadcrumb's parent where nothing lies behind. */
  protected back(): void {
    const parentLink = this.breadcrumb.parentLink();
    if (this.history.canGoBack()) {
      this.history.back();
    } else if (parentLink !== undefined) {
      void this.router.navigate(parentLink);
    }
  }
}
