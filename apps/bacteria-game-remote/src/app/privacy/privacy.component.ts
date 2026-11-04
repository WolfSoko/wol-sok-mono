import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import {
  buyMeACoffeeUrl,
  GameAds,
  LEGAL_NOTICE_PATH,
  StatsConsent,
} from '@wolsok/feat-lazy-bac-game';
import { SUPPORT_DEFAULTS } from '../../environments/game-support';
import { setUpLegalPage } from '../legal/legal-page';
import {
  EmailForwardingComponent,
  SITE_OWNER,
  SiteOwnerComponent,
} from '@wolsok/shared-legal';

function buyMeACoffeeLink(handle: string): { url: string; label: string } {
  const url = buyMeACoffeeUrl(handle);
  return { url, label: url.replace(/^https:\/\//, '') };
}

/**
 * The privacy policy of the game, its web app and its Android app, in
 * German (binding) and English. Only on the game's own site: the shell
 * loads the game's routes, not this one.
 */
@Component({
  selector: 'wolsok-privacy',
  imports: [
    EmailForwardingComponent,
    MatButtonModule,
    RouterLink,
    SiteOwnerComponent,
  ],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyComponent {
  /** For the email in the deletion links. */
  protected readonly owner = SITE_OWNER;
  protected readonly legalNoticePath = LEGAL_NOTICE_PATH;
  /** The page the tip button leads to on the web, named in section 8. */
  protected readonly buyMeACoffee = buyMeACoffeeLink(
    SUPPORT_DEFAULTS.buyMeACoffeeHandle
  );
  /**
   * The ad network section 7 describes, and the way back into its consent
   * window, as in the game's footer: shown once the window answered, which
   * it does only where the game support (and with it the network) is set
   * up, on the game's own site.
   */
  protected readonly ads = inject(GameAds);
  /**
   * The usage statistics' switch, as in the game's settings: only where
   * the game measures, on its own site.
   */
  protected readonly stats = inject(StatsConsent);

  protected readonly page = setUpLegalPage({
    title: 'Datenschutz - Bacteria Wars',
    description:
      'Datenschutzerklärung von Bacteria Wars, im Web und als Android-App. ' +
      'Privacy policy of Bacteria Wars, on the web and as an Android app.',
  });
}
