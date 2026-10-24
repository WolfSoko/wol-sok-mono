import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { GAME_SITE_URL, PRIVACY_POLICY_PATH } from '@wolsok/feat-lazy-bac-game';
import { setUpLegalPage } from '../legal/legal-page';
import { SITE_OWNER } from '../legal/site-owner';
import { SiteOwnerComponent } from '../legal/site-owner.component';

/**
 * The legal notice (Impressum) the game's site owes under § 5 DDG, in
 * German (binding) and English. Only on the game's own site: the shell
 * loads the game's routes, not this one.
 */
@Component({
  selector: 'wolsok-impressum',
  imports: [MatButtonModule, RouterLink, SiteOwnerComponent],
  templateUrl: './impressum.component.html',
  styleUrl: './impressum.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImpressumComponent {
  /** For the email in the contact paragraphs. */
  protected readonly owner = SITE_OWNER;
  protected readonly siteUrl = GAME_SITE_URL;
  protected readonly siteHost = new URL(GAME_SITE_URL).host;
  protected readonly privacyPolicyPath = PRIVACY_POLICY_PATH;

  protected readonly page = setUpLegalPage({
    title: 'Impressum - Bacteria Wars',
    description:
      'Impressum von Bacteria Wars, im Web und als Android-App: Anbieter, Kontakt und Haftung. ' +
      'Legal notice of Bacteria Wars, on the web and as an Android app.',
  });
}
