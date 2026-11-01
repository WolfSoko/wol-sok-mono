import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_OWNER, SiteOwnerComponent } from '@wolsok/shared-legal';
import { SITE_TAGS, usePageTags } from './site-tags';

/**
 * RollaPolla's legal notice (Impressum, § 5 DDG and § 18 MStV): who runs
 * the site and how to reach them, also as the Digital Services Act's point
 * of contact and for reports of unlawful polls and messages.
 */
@Component({
  selector: 'rap-impressum-page',
  imports: [RouterLink, SiteOwnerComponent],
  templateUrl: './impressum.page.html',
  styleUrl: './legal-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ImpressumPageComponent {
  /** For the email in the contact paragraph. */
  protected readonly owner = SITE_OWNER;

  constructor() {
    usePageTags({
      title: 'Legal notice (Impressum) | RollaPolla',
      description:
        'Who runs RollaPolla: provider, postal address and contact, and how to report unlawful polls and messages.',
      socialDescription: 'Who runs RollaPolla, and how to reach them.',
      robots: SITE_TAGS.robots,
    });
  }
}
