import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_OWNER, SiteOwnerComponent } from '@wolsok/shared-legal';
import { SITE_HOST, SITE_URL } from '../../shared/site';
import { DbbLinkComponent } from './dbb-link.component';

/** The legal notice (Impressum, § 5 DDG), in German like the whole app. */
@Component({
  selector: 'korb-impressum',
  imports: [DbbLinkComponent, RouterLink, SiteOwnerComponent],
  templateUrl: './impressum.component.html',
  styleUrl: './legal-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImpressumComponent {
  /** For the email in the contact paragraph and the VAT ID. */
  protected readonly provider = SITE_OWNER;
  protected readonly page = SITE_URL;
  protected readonly host = SITE_HOST;
}
