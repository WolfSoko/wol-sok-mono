import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DBB_WEBSITE_URL } from '@wolsok/feat-shared-basketball-data';

/**
 * The DBB's public site, as the footer, the Impressum and the privacy
 * policy name it where they say the data comes from there.
 */
@Component({
  selector: 'korb-dbb-link',
  template: `<a [href]="url">basketball-bund.net</a>`,
  styles: `
    a {
      color: inherit;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DbbLinkComponent {
  protected readonly url = DBB_WEBSITE_URL;
}
