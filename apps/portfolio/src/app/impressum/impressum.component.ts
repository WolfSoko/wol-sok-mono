import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_OWNER, SiteOwnerComponent } from '@wolsok/shared-legal';

/**
 * The legal notice (Impressum) wolsok.de owes under § 5 DDG, in German
 * (binding) with a short English version, like the privacy policy.
 */
@Component({
  selector: 'wolsok-impressum',
  imports: [RouterLink, SiteOwnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './impressum.component.html',
  styleUrl: '../legal/legal-page.scss',
})
export class ImpressumComponent {
  /** For the email in the contact paragraph and the VAT ID. */
  protected readonly owner = SITE_OWNER;
}
