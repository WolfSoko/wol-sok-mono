import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_OWNER } from '@wolsok/shared-legal';
import { ConsentSettingsComponent } from '../core/consent/consent-settings.component';
import { SITE_TAGS, usePageTags } from './site-tags';

/**
 * RollaPolla's privacy policy (GDPR Art. 13): who runs the site, what it
 * keeps and where, and the usage statistics and ads it uses only with the
 * visitor's consent. Keep it in step with what the site does - a new
 * purpose of `SiteConsent`, a new collection or a new third party belongs
 * here in the same change.
 */
@Component({
  selector: 'rap-privacy-page',
  imports: [ConsentSettingsComponent, RouterLink],
  templateUrl: './privacy.page.html',
  styleUrl: './privacy.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PrivacyPageComponent {
  protected readonly owner = SITE_OWNER;

  constructor() {
    usePageTags({
      title: 'Privacy policy | RollaPolla',
      description:
        'How RollaPolla handles your data: polls, votes and chats, sign-in, and the usage statistics and ads it uses only with your consent.',
      socialDescription:
        'How RollaPolla handles your data, and what it uses only with your consent.',
      robots: SITE_TAGS.robots,
    });
  }
}
