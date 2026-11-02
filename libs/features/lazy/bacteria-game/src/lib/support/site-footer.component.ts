import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../i18n/translate.pipe';
import { GameAds } from './ads/game-ads.service';
import { GAME_SUPPORT } from './game-support';
import { LEGAL_NOTICE_PATH, PRIVACY_POLICY_PATH } from './legal-links';

/**
 * The legal lines a site owes under every page: who runs it, the privacy
 * policy, the legal notice (Impressum) and, once the consent banner was
 * answered, the way back into it. Shown by the menu on the game's own
 * site only, in the browser and the Play Store app alike, where the pages
 * are routes of this app: the shell has pages of its own.
 */
@Component({
  selector: 'feat-lazy-bac-game-site-footer',
  imports: [RouterLink, TranslatePipe],
  template: `
    <footer class="footer">
      <span class="owner">© {{ year }} {{ owner }}</span>
      <nav class="links" [attr.aria-label]="'support.footer.label' | t">
        <a [routerLink]="['/', privacyPolicyPath]">{{
          'support.footer.privacy' | t
        }}</a>
        <a [routerLink]="['/', legalNoticePath]">{{
          'support.footer.legalNotice' | t
        }}</a>
        @if (ads.consentAnswered()) {
          <button type="button" (click)="ads.openConsentSettings()">
            {{ 'support.adSettings' | t }}
          </button>
        }
      </nav>
    </footer>
  `,
  styles: `
    :host {
      display: block;
    }

    .footer {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem 1.5rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--bw-line);
      font-size: 0.85rem;
      color: var(--bw-muted);
    }

    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1.25rem;
    }

    a,
    button {
      padding: 0;
      border: 0;
      background: none;
      color: var(--bw-soft);
      font: inherit;
      text-decoration: underline;
      text-underline-offset: 0.2em;
      cursor: pointer;
    }

    a:hover,
    button:hover {
      color: var(--bw-text);
    }

    a:focus-visible,
    button:focus-visible {
      outline: 2px solid var(--bw-gold);
      outline-offset: 2px;
      border-radius: 2px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooterComponent {
  protected readonly ads = inject(GameAds);

  protected readonly owner = inject(GAME_SUPPORT)?.siteOwner ?? '';
  protected readonly year = new Date().getFullYear();
  protected readonly privacyPolicyPath = PRIVACY_POLICY_PATH;
  protected readonly legalNoticePath = LEGAL_NOTICE_PATH;
}
