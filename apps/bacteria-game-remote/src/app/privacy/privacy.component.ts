import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { LEGAL_NOTICE_PATH } from '@wolsok/feat-lazy-bac-game';
import { setUpLegalPage } from '../legal/legal-page';
import { SITE_OWNER } from '../legal/site-owner';
import { SiteOwnerComponent } from '../legal/site-owner.component';

/**
 * The privacy policy of the game, its web app and its Android app, in
 * German (binding) and English. Only on the game's own site: the shell
 * loads the game's routes, not this one.
 */
@Component({
  selector: 'wolsok-privacy',
  imports: [MatButtonModule, RouterLink, SiteOwnerComponent],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyComponent {
  /** For the email in the deletion links. */
  protected readonly owner = SITE_OWNER;
  protected readonly legalNoticePath = LEGAL_NOTICE_PATH;

  protected readonly page = setUpLegalPage({
    title: 'Datenschutz - Bacteria Wars',
    description:
      'Datenschutzerklärung von Bacteria Wars, im Web und als Android-App. ' +
      'Privacy policy of Bacteria Wars, on the web and as an Android app.',
  });
}
