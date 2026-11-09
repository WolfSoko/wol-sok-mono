import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_OWNER, SiteOwnerComponent } from '@wolsok/shared-legal';
import { SITE_URL } from '../../shared/site';
import { DATENSCHUTZ_PFAD } from './rechtliche-pfade';

/** The legal notice (Impressum, § 5 DDG), in German like the whole app. */
@Component({
  selector: 'korb-impressum',
  imports: [RouterLink, SiteOwnerComponent],
  templateUrl: './impressum.component.html',
  styleUrl: './rechtliche-seite.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImpressumComponent {
  /** For the email in the contact paragraph and the VAT ID. */
  protected readonly anbieter = SITE_OWNER;
  protected readonly seite = SITE_URL;
  protected readonly host = new URL(SITE_URL).host;
  protected readonly datenschutz = DATENSCHUTZ_PFAD;
}
