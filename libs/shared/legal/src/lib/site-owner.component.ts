import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SITE_OWNER } from './site-owner';

/**
 * Who runs the site, as the legal pages name them: name, postal address
 * and email, a line each. The label before the email is the page's, in the
 * page's language. The page styles the block through this element; the
 * link takes `--site-owner-link-color`.
 */
@Component({
  selector: 'wolsok-site-owner',
  template: `
    <address>
      {{ owner.name }}<br />
      @for (line of owner.addressLines; track line) {
        {{ line }}<br />
      }
      {{ emailLabel() }}:
      <a href="mailto:{{ owner.email }}">{{ owner.email }}</a>
    </address>
  `,
  styles: `
    :host {
      display: block;
    }

    address {
      font-style: normal;
    }

    a {
      color: var(--site-owner-link-color, LinkText);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteOwnerComponent {
  public readonly emailLabel = input.required<string>();

  protected readonly owner = SITE_OWNER;
}
