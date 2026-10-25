import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Meta, Title } from '@angular/platform-browser';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { SPLASH_ID } from '@wolsok/feat-lazy-bac-game/admin-kit';
import { AdminAccessService } from './access/admin-access.service';
import { AdminI18n, AdminTextPipe } from './i18n/admin-i18n.service';

/**
 * The admin area's frame: the title, its views' tabs once the owner is in,
 * and sign-out. Keeps search engines out of every admin view, and takes
 * down the page's loading splash, which only the game would.
 */
@Component({
  selector: 'feat-lazy-bac-admin-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdminTextPipe,
    MatButtonModule,
    MatTabsModule,
    MatToolbarModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  template: `
    <mat-toolbar>
      <h1>{{ 'title' | adminT }}</h1>
      <span class="spacer"></span>
      @if (access.access() === 'granted' || access.access() === 'no-access') {
        <button mat-button type="button" (click)="signOut()">
          {{ 'gate.signOut' | adminT }}
        </button>
      }
    </mat-toolbar>
    @if (access.access() === 'granted') {
      <nav mat-tab-nav-bar [tabPanel]="panel">
        <a
          mat-tab-link
          routerLink="."
          routerLinkActive
          #overview="routerLinkActive"
          [routerLinkActiveOptions]="{ exact: true }"
          [active]="overview.isActive"
        >
          {{ 'nav.overview' | adminT }}
        </a>
      </nav>
    }
    <mat-tab-nav-panel #panel>
      <main>
        <router-outlet />
      </main>
    </mat-tab-nav-panel>
  `,
  styles: `
    /* The remote's prebuilt Material theme (pink-bluegrey) is dark and
       sets no system tokens: the frame gives its surface. */
    :host {
      display: block;
      min-height: 100dvh;
      background: #303030;
      color: rgb(255 255 255 / 87%);
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 500;
      margin: 0;
    }
    .spacer {
      flex: 1;
    }
    main {
      padding: 1rem;
      max-width: 72rem;
      margin: 0 auto;
    }
  `,
})
export class AdminShellComponent {
  protected readonly access = inject(AdminAccessService);
  private readonly router = inject(Router);

  /** Signs out, then lets the guard run again, so the gate replaces the view. */
  protected async signOut(): Promise<void> {
    await this.access.signOut();
    await this.router.navigateByUrl(this.router.url, {
      onSameUrlNavigation: 'reload',
    });
  }

  public constructor() {
    inject(DOCUMENT).getElementById(SPLASH_ID)?.remove();
    const meta = inject(Meta);
    const title = inject(Title);
    const i18n = inject(AdminI18n);
    const robots = meta.getTag('name="robots"')?.content ?? null;
    meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    title.setTitle(i18n.t('title'));
    inject(DestroyRef).onDestroy(() => {
      if (robots === null) {
        meta.removeTag('name="robots"');
      } else {
        meta.updateTag({ name: 'robots', content: robots });
      }
    });
  }
}
