import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslationKey } from '../i18n/dictionaries';
import { TranslatePipe } from '../i18n/translate.pipe';
import { InstallOffer } from './install-offer.service';

/**
 * The offer to play the game as an app, on the main menu of the game's own
 * site: the Android app on Google Play, the web app installed from the
 * browser, or on iOS the way to the home screen. `InstallOffer` decides
 * whether there is anything to offer.
 */
@Component({
  selector: 'feat-lazy-bac-game-install-banner',
  imports: [MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    @if (offer.visible()) {
      <aside class="banner" [attr.aria-label]="'site.install.title' | t">
        <mat-icon class="badge" aria-hidden="true">install_mobile</mat-icon>
        <div class="text">
          <strong class="title">{{ 'site.install.title' | t }}</strong>
          <p class="note">{{ note | t }}</p>
        </div>
        <div class="actions">
          @if (offer.platform === 'android' && offer.storeUrl; as url) {
            <a
              mat-flat-button
              class="store"
              [href]="url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <mat-icon>shop</mat-icon>
              {{ 'site.install.playStore' | t }}
            </a>
          }
          @if (offer.canInstallWebApp()) {
            <button
              mat-flat-button
              type="button"
              class="web-app"
              (click)="offer.installWebApp()"
            >
              <mat-icon>download</mat-icon>
              {{ 'site.install.webApp' | t }}
            </button>
          }
        </div>
        <button
          mat-icon-button
          type="button"
          class="dismiss"
          [attr.aria-label]="'site.install.dismiss' | t"
          (click)="offer.dismiss()"
        >
          <mat-icon>close</mat-icon>
        </button>
      </aside>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    // Without an offer the host would still take a slot, and a gap, in the menu's column.
    :host:empty {
      display: none;
    }

    .banner {
      position: relative;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.5rem 1rem;
      align-items: center;
      box-sizing: border-box;
      padding: 1rem 3rem 1rem 1.25rem;
      border: 2px solid var(--bw-gold);
      border-radius: 1.25rem;
      background:
        linear-gradient(135deg, rgb(233 185 73 / 18%), transparent 60%),
        var(--bw-surface-glass);
      box-shadow: 0 0 40px rgb(233 185 73 / 20%);
      color: var(--bw-text);
    }

    .badge {
      width: 2.5rem;
      height: 2.5rem;
      font-size: 2.5rem;
      color: var(--bw-gold);
    }

    .text {
      min-width: 0;
    }

    .title {
      display: block;
      font-family: var(--bw-display);
      font-weight: 800;
      font-size: 1.35rem;
      line-height: 1.15;
    }

    .note {
      margin: 0.25rem 0 0;
      line-height: 1.4;
      color: var(--bw-soft);
    }

    .actions {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .actions:empty {
      display: none;
    }

    .store {
      --mat-button-filled-container-color: var(--bw-gold);
      --mat-button-filled-label-text-color: var(--bw-ground);
    }

    .web-app {
      --mat-button-filled-container-color: var(--bw-player);
      --mat-button-filled-label-text-color: var(--bw-on-player);
    }

    .dismiss {
      position: absolute;
      top: 0.4rem;
      right: 0.4rem;
      color: var(--bw-soft);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstallBannerComponent {
  protected readonly offer = inject(InstallOffer);

  /** How the app helps, and how to get it, where the player is. */
  protected get note(): TranslationKey {
    return `site.install.${this.offer.platform}`;
  }
}
